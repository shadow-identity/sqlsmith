import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	DependencyError,
	ErrorCode,
	type SqlDialect,
	SqlMerger,
} from '../src/index.js';

// Contract for first-class CREATE INDEX / ALTER TABLE statements: they join
// the dependency graph (no RAW_STATEMENTS noise), order after every relation
// they reference — across files — and can be opted out back to raw passthrough.

const fixture = (dialect: SqlDialect, scenario: string): string =>
	resolve(process.cwd(), `test/fixtures/${dialect}/${scenario}`);

const temporaryDirectories: string[] = [];

async function createSqlDirectory(
	files: Record<string, string>,
): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'sqlsmith-index-alter-'));
	temporaryDirectories.push(directory);
	await Promise.all(
		Object.entries(files).map(([name, content]) =>
			writeFile(join(directory, name), content, 'utf8'),
		),
	);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

const mergeScenario = (
	dialect: SqlDialect,
	scenario: string,
	merger = new SqlMerger(),
): string => {
	const plan = merger.planDirectory(fixture(dialect, scenario), dialect);
	return merger.merge(plan, { addComments: false, includeHeader: false });
};

describe('first-class CREATE INDEX and ALTER TABLE', () => {
	it('recognizes indexes and alters without raw diagnostics (postgresql)', () => {
		const merger = new SqlMerger();
		const plan = merger.planDirectory(
			fixture('postgresql', 'correct/indexes_and_alters'),
			'postgresql',
		);

		expect(plan.diagnostics).toEqual([]);
		expect(plan.statements.map(({ type }) => type)).toEqual(
			expect.arrayContaining(['table', 'index', 'alter']),
		);
	});

	it('orders an FK alter after every table it references, across files (postgresql)', () => {
		const merged = mergeScenario('postgresql', 'correct/indexes_and_alters');

		const posOrgs = merged.indexOf('CREATE TABLE orgs');
		const posUsers = merged.indexOf('CREATE TABLE users');
		const posFkAlter = merged.indexOf(
			'ALTER TABLE users ADD CONSTRAINT users_org_fk',
		);
		const posColumnAlter = merged.indexOf('ALTER TABLE users ADD COLUMN age');
		const posIndex = merged.indexOf('CREATE INDEX idx_users_name');

		expect(posOrgs).toBeGreaterThanOrEqual(0);
		expect(posUsers).toBeGreaterThanOrEqual(0);
		expect(posFkAlter).toBeGreaterThan(posUsers);
		expect(posFkAlter).toBeGreaterThan(posOrgs);
		expect(posColumnAlter).toBeGreaterThan(posUsers);
		expect(posIndex).toBeGreaterThan(posUsers);
	});

	it('matches quoted index targets against quoted table declarations (postgresql)', () => {
		const merged = mergeScenario('postgresql', 'correct/indexes_and_alters');

		const posQuotedTable = merged.indexOf('CREATE TABLE "Users"');
		const posQuotedIndex = merged.indexOf('CREATE UNIQUE INDEX "Idx"');

		expect(posQuotedTable).toBeGreaterThanOrEqual(0);
		expect(posQuotedIndex).toBeGreaterThan(posQuotedTable);
	});

	it('recognizes keyword-less sqlite ALTER TABLE and orders it after its table', () => {
		const merger = new SqlMerger();
		const plan = merger.planDirectory(
			fixture('sqlite', 'correct/indexes_and_alters'),
			'sqlite',
		);
		const merged = merger.merge(plan, {
			addComments: false,
			includeHeader: false,
		});

		expect(plan.diagnostics).toEqual([]);
		expect(merged.indexOf('CREATE TABLE users')).toBeLessThan(
			merged.indexOf('ALTER TABLE users ADD COLUMN age'),
		);
		expect(merged.indexOf('CREATE TABLE users')).toBeLessThan(
			merged.indexOf('CREATE INDEX idx_users_name'),
		);
	});

	it('allows same-named indexes on different tables (mysql) and orders each after its table', () => {
		const merger = new SqlMerger();
		const plan = merger.planDirectory(
			fixture('mysql', 'correct/indexes_and_alters'),
			'mysql',
		);
		const merged = merger.merge(plan, {
			addComments: false,
			includeHeader: false,
		});

		expect(plan.diagnostics).toEqual([]);
		expect(merged.indexOf('CREATE TABLE a')).toBeLessThan(
			merged.indexOf('CREATE INDEX idx_name ON a'),
		);
		expect(merged.indexOf('CREATE TABLE b')).toBeLessThan(
			merged.indexOf('CREATE INDEX idx_name ON b'),
		);
		const posFkAlter = merged.indexOf('ALTER TABLE orders ADD CONSTRAINT');
		expect(posFkAlter).toBeGreaterThan(merged.indexOf('CREATE TABLE orders'));
		expect(posFkAlter).toBeGreaterThan(merged.indexOf('CREATE TABLE users'));
	});

	it('rejects two same-named indexes on the same table (postgresql)', async () => {
		const directory = await createSqlDirectory({
			'schema.sql': [
				'CREATE TABLE users (id integer PRIMARY KEY, name text);',
				'CREATE INDEX idx ON users (id);',
				'CREATE INDEX idx ON users (name);',
			].join('\n'),
		});

		expect(() =>
			new SqlMerger().planDirectory(directory, 'postgresql'),
		).toThrowError(
			expect.objectContaining({ code: ErrorCode.DUPLICATE_STATEMENT_NAMES }),
		);
	});

	it('recognizes an unnamed postgresql index and depends it on its table', async () => {
		const directory = await createSqlDirectory({
			'schema.sql': [
				'CREATE TABLE users (id integer PRIMARY KEY, name text);',
				'CREATE INDEX ON users (name);',
			].join('\n'),
		});
		const merger = new SqlMerger();

		const file = merger.parseSingleFile(
			join(directory, 'schema.sql'),
			'postgresql',
		);
		const index = file.statements[1];

		expect(index.type).toBe('index');
		expect(index.identifier).toBeDefined();
		expect(index.dependsOn.map(({ identifier }) => identifier.key)).toEqual([
			'["relation","public","users"]',
		]);

		const plan = merger.planDirectory(directory, 'postgresql');
		expect(plan.diagnostics).toEqual([]);
	});

	it('preserves quote fidelity for index targets', async () => {
		const directory = await createSqlDirectory({
			'schema.sql': [
				'CREATE TABLE "Users" ("Id" integer PRIMARY KEY);',
				'CREATE UNIQUE INDEX "Idx" ON "Users" ("Id");',
			].join('\n'),
		});

		const file = new SqlMerger().parseSingleFile(
			join(directory, 'schema.sql'),
			'postgresql',
		);
		const index = file.statements[1];

		expect(index.type).toBe('index');
		expect(index.dependsOn.map(({ identifier }) => identifier.key)).toEqual([
			'["relation","public","Users"]',
		]);
	});

	it('deduplicates a self-referencing FK alter to a single dependency', async () => {
		const directory = await createSqlDirectory({
			'schema.sql': [
				'CREATE TABLE users (id integer PRIMARY KEY, parent_id integer);',
				'ALTER TABLE users ADD CONSTRAINT users_parent_fk FOREIGN KEY (parent_id) REFERENCES users(id);',
			].join('\n'),
		});

		const file = new SqlMerger().parseSingleFile(
			join(directory, 'schema.sql'),
			'postgresql',
		);
		const alter = file.statements[1];

		expect(alter.type).toBe('alter');
		expect(alter.dependsOn.map(({ identifier }) => identifier.key)).toEqual([
			'["relation","public","users"]',
		]);
	});

	it('collects both the altered table and FK targets as dependencies', async () => {
		const directory = await createSqlDirectory({
			'schema.sql': [
				'CREATE TABLE orgs (id integer PRIMARY KEY);',
				'CREATE TABLE users (id integer PRIMARY KEY, org_id integer);',
				'ALTER TABLE users ADD CONSTRAINT users_org_fk FOREIGN KEY (org_id) REFERENCES orgs(id);',
			].join('\n'),
		});

		const file = new SqlMerger().parseSingleFile(
			join(directory, 'schema.sql'),
			'postgresql',
		);
		const alter = file.statements[2];

		expect(alter.type).toBe('alter');
		expect(alter.dependsOn.map(({ identifier }) => identifier.key)).toEqual([
			'["relation","public","users"]',
			'["relation","public","orgs"]',
		]);
	});

	it('collects FK targets declared inline on ADD COLUMN', async () => {
		const directory = await createSqlDirectory({
			'schema.sql': [
				'CREATE TABLE orgs (id integer PRIMARY KEY);',
				'CREATE TABLE users (id integer PRIMARY KEY);',
				'ALTER TABLE users ADD COLUMN org_id integer REFERENCES orgs(id);',
			].join('\n'),
		});

		const file = new SqlMerger().parseSingleFile(
			join(directory, 'schema.sql'),
			'postgresql',
		);
		const alter = file.statements[2];

		expect(alter.type).toBe('alter');
		expect(alter.dependsOn.map(({ identifier }) => identifier.key)).toEqual([
			'["relation","public","users"]',
			'["relation","public","orgs"]',
		]);
	});

	it('rejects an ALTER that precedes its table within one file', async () => {
		const directory = await createSqlDirectory({
			'schema.sql': [
				'ALTER TABLE users ADD COLUMN age integer;',
				'CREATE TABLE users (id integer PRIMARY KEY);',
			].join('\n'),
		});

		expect(() =>
			new SqlMerger().planDirectory(directory, 'postgresql'),
		).toThrowError(
			expect.objectContaining({ code: ErrorCode.INVALID_STATEMENT_ORDER }),
		);
	});

	describe('strictness on missing targets', () => {
		const missingPath = fixture('postgresql', 'invalid/index_missing_table');

		it('throws MISSING_DEPENDENCY when an index targets an unknown table', () => {
			try {
				new SqlMerger().planDirectory(missingPath, 'postgresql');
				expect.fail('expected planDirectory to throw');
			} catch (error) {
				expect(error).toBeInstanceOf(DependencyError);
				expect(error).toMatchObject({ code: ErrorCode.MISSING_DEPENDENCY });
			}
		});

		it('merges with an EXTERNAL_REFERENCE diagnostic when allowed', () => {
			const merger = new SqlMerger({ allowExternalReferences: true });
			const plan = merger.planDirectory(missingPath, 'postgresql');
			const merged = merger.merge(plan, {
				addComments: false,
				includeHeader: false,
			});

			expect(merged).toContain('CREATE INDEX idx_ghosts_name');
			expect(plan.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: 'EXTERNAL_REFERENCE',
						dependencyName: 'ghosts',
					}),
				]),
			);
		});
	});

	describe('opt-out flags', () => {
		it('exposes index and alter as supported types by default', () => {
			const types = new SqlMerger().getSupportedTypes();

			expect(types).toContain('index');
			expect(types).toContain('alter');
		});

		it('restores raw passthrough with enableIndexes/enableAlters disabled', () => {
			const merger = new SqlMerger({
				enableIndexes: false,
				enableAlters: false,
			});
			const plan = merger.planDirectory(
				fixture('postgresql', 'correct/raw_statements'),
				'postgresql',
			);

			expect(plan.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: 'RAW_STATEMENTS', count: 4 }),
				]),
			);
			expect(merger.getSupportedTypes()).not.toContain('index');
			expect(merger.getSupportedTypes()).not.toContain('alter');
		});
	});
});

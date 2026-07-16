import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DependencyError, ErrorCode, SqlMerger } from '../src/index.js';

// C6A-MODEL / C6A-NORMALIZE / C6A-COLLISION / C6A-NAMESPACE
// R6A-01 / R6A-02 / R6A-03 / R6A-05

const temporaryDirectories: string[] = [];

async function createSqlDirectory(
	files: Record<string, string>,
): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'sql-merger-identifiers-'));
	temporaryDirectories.push(directory);

	await Promise.all(
		Object.entries(files).map(([name, content]) =>
			writeFile(join(directory, name), content, 'utf8'),
		),
	);

	return directory;
}

function captureError(operation: () => unknown): unknown {
	try {
		operation();
	} catch (error) {
		return error;
	}
	throw new Error('Expected operation to throw');
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe('canonical relation identifier contract', () => {
	it('builds immutable, lossless identifiers from the original PostgreSQL source', async () => {
		const directory = await createSqlDirectory({
			'table.sql': `CREATE TABLE "tenant.one"."Users" (
  id bigint PRIMARY KEY,
  manager_id bigint REFERENCES "tenant.one"."Users"(id)
);`,
		});
		const merger = new SqlMerger();

		const file = await merger.parseSingleFile(join(directory, 'table.sql'));
		const [statement] = file.statements;
		const [dependency] = statement.dependsOn;

		expect(statement.identifier).toEqual({
			namespace: 'relation',
			schema: {
				value: 'tenant.one',
				canonical: 'tenant.one',
				display: '"tenant.one"',
				quoted: true,
				explicit: true,
			},
			name: {
				value: 'Users',
				canonical: 'Users',
				display: '"Users"',
				quoted: true,
				explicit: true,
			},
			display: '"tenant.one"."Users"',
			key: '["relation","tenant.one","Users"]',
		});
		expect(dependency.identifier).toEqual(statement.identifier);
		expect(statement.name).toBe(statement.identifier?.display);
		expect(dependency.name).toBe(dependency.identifier.display);
		expect(statement.content).toContain('"tenant.one"."Users"');
		expect(Object.isFrozen(statement.identifier)).toBe(true);
		expect(Object.isFrozen(statement.identifier?.schema)).toBe(true);
		expect(Object.isFrozen(statement.identifier?.name)).toBe(true);

		const merged = merger.merge(merger.planDirectory(directory), {
			addComments: true,
			includeHeader: false,
		});
		expect(merged).toContain(
			'-- table: "tenant.one"."Users" (from table.sql) — depends on: "tenant.one"."Users"',
		);
	});

	it('uses PostgreSQL folding and a configurable default schema', async () => {
		const directory = await createSqlDirectory({
			'users.sql': 'CREATE TABLE USERS (id bigint PRIMARY KEY);',
		});
		const merger = new SqlMerger({
			defaultSchema: 'tenant',
		});

		const file = await merger.parseSingleFile(join(directory, 'users.sql'));
		const identifier = file.statements[0]?.identifier;

		expect(identifier?.schema).toEqual({
			value: 'tenant',
			canonical: 'tenant',
			display: 'tenant',
			quoted: false,
			explicit: false,
		});
		expect(identifier?.name.canonical).toBe('users');
		expect(identifier?.name.display).toBe('USERS');
		expect(identifier?.display).toBe('USERS');
		expect(identifier?.key).toBe('["relation","tenant","users"]');
	});

	it('keeps quoted dots distinct from qualification in collision-safe graph keys', async () => {
		const directory = await createSqlDirectory({
			'quoted.sql': 'CREATE TABLE "a.b" (id int);',
			'qualified.sql': 'CREATE TABLE a.b (id int);',
		});
		const plan = await new SqlMerger().planDirectory(directory);
		const identifiers = plan.files.flatMap((file) =>
			file.statements.flatMap((statement) => statement.identifier ?? []),
		);

		expect(identifiers.map(({ key }) => JSON.parse(key))).toEqual([
			['relation', 'a', 'b'],
			['relation', 'public', 'a.b'],
		]);
		expect(new Set(identifiers.map(({ key }) => key))).toHaveLength(2);
		expect([...plan.graph.nodes]).toEqual(
			expect.arrayContaining(identifiers.map(({ key }) => key)),
		);
	});

	it('folds unquoted names while keeping quoted mixed case distinct', async () => {
		const duplicateDirectory = await createSqlDirectory({
			'lower.sql': 'CREATE TABLE users (id int);',
			'upper.sql': 'CREATE TABLE USERS (id int);',
			'quoted.sql': 'CREATE TABLE "users" (id int);',
		});

		expect(
			captureError(() => new SqlMerger().planDirectory(duplicateDirectory)),
		).toMatchObject({
			code: ErrorCode.DUPLICATE_STATEMENT_NAMES,
			context: {
				duplicates: [
					{
						key: '["relation","public","users"]',
						files: expect.arrayContaining([
							'lower.sql',
							'quoted.sql',
							'upper.sql',
						]),
					},
				],
			},
		});

		const distinctDirectory = await createSqlDirectory({
			'lower.sql': 'CREATE TABLE users (id int);',
			'quoted.sql': 'CREATE TABLE "Users" (id int);',
		});
		const plan = await new SqlMerger().planDirectory(distinctDirectory);

		expect(plan.graph.nodes).toHaveLength(2);
	});

	it('shares one relation namespace across tables, views, and sequences', async () => {
		const tableViewDirectory = await createSqlDirectory({
			'table.sql': 'CREATE TABLE public.users (id int);',
			'view.sql': 'CREATE VIEW public.users AS SELECT 1 AS id;',
		});
		const tableSequenceDirectory = await createSqlDirectory({
			'table.sql': 'CREATE TABLE public.ids (id int);',
			'sequence.sql': 'CREATE SEQUENCE public.ids;',
		});

		expect(
			captureError(() => new SqlMerger().planDirectory(tableViewDirectory)),
		).toMatchObject({ code: ErrorCode.DUPLICATE_STATEMENT_NAMES });
		expect(
			captureError(() => new SqlMerger().planDirectory(tableSequenceDirectory)),
		).toMatchObject({ code: ErrorCode.DUPLICATE_STATEMENT_NAMES });

		const distinctSchemas = await createSqlDirectory({
			'table.sql': 'CREATE TABLE public.users (id int);',
			'view.sql': 'CREATE VIEW audit.users AS SELECT 1 AS id;',
		});
		const plan = await new SqlMerger().planDirectory(distinctSchemas);

		expect(plan.statements).toHaveLength(2);
		expect(plan.statements.map(({ type }) => type)).toEqual(
			expect.arrayContaining(['table', 'view']),
		);
	});

	it('uses the same key for self references and dependency diagnostics', async () => {
		const selfDirectory = await createSqlDirectory({
			'self.sql': `CREATE TABLE "tenant.one"."Users" (
        id int PRIMARY KEY,
        parent_id int REFERENCES "tenant.one"."Users"(id)
      );`,
		});
		const selfPlan = await new SqlMerger().planDirectory(selfDirectory);
		const selfKey = selfPlan.statements[0]?.identifier?.key;

		expect(selfPlan.statements).toHaveLength(1);
		expect(selfPlan.graph.edges.get(selfKey ?? '')).toEqual(new Set([selfKey]));

		const missingDirectory = await createSqlDirectory({
			'orders.sql': `CREATE TABLE orders (
        id int,
        customer_id int REFERENCES "tenant.one"."Customers"(id)
      );`,
		});

		try {
			await new SqlMerger().planDirectory(missingDirectory);
			expect.unreachable('Expected a missing dependency');
		} catch (error) {
			expect(error).toBeInstanceOf(DependencyError);
			expect(error).toMatchObject({
				context: {
					dependencyName: '"tenant.one"."Customers"',
					dependencyKey: '["relation","tenant.one","Customers"]',
					statementName: 'orders',
					statementKey: '["relation","public","orders"]',
				},
			});
		}

		const cycleDirectory = await createSqlDirectory({
			'a.sql': 'CREATE TABLE public.a (b_id int REFERENCES audit.b(id));',
			'b.sql': 'CREATE TABLE audit.b (a_id int REFERENCES public.a(id));',
		});
		expect(
			captureError(() =>
				new SqlMerger({ validateSourceOrder: false }).planDirectory(
					cycleDirectory,
				),
			),
		).toMatchObject({
			code: ErrorCode.CIRCULAR_DEPENDENCY,
			context: {
				cycles: [['public.a', 'audit.b', 'public.a']],
				cycleKeys: [
					[
						'["relation","public","a"]',
						'["relation","audit","b"]',
						'["relation","public","a"]',
					],
				],
			},
		});
	});

	it('validates source order by relation key instead of display name', async () => {
		const directory = await createSqlDirectory({
			'relations.sql': `
        CREATE TABLE audit.users (id int PRIMARY KEY);
        CREATE TABLE audit.orders (
          id int PRIMARY KEY,
          user_id int REFERENCES public.users(id)
        );
        CREATE TABLE public.users (id int PRIMARY KEY);
      `,
		});

		expect(
			captureError(() =>
				new SqlMerger({
					validateSourceOrder: true,
				}).planDirectory(directory),
			),
		).toMatchObject({
			code: ErrorCode.INVALID_STATEMENT_ORDER,
			context: {
				statementKey: '["relation","audit","orders"]',
				dependencyKey: '["relation","public","users"]',
			},
		});

		const plan = await new SqlMerger({
			validateSourceOrder: false,
		}).planDirectory(directory);
		const keys = plan.orderedStatements.map(
			({ identifier }) => identifier?.key,
		);

		expect(keys.indexOf('["relation","public","users"]')).toBeLessThan(
			keys.indexOf('["relation","audit","orders"]'),
		);
	});
});

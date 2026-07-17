import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqlMerger } from '../src/index.js';

// Diagnostic severity contract: raw passthrough is informational; a warning is
// reserved for cases where the emitted order is genuinely at risk — raw-only
// files and raw statements referencing a relation defined in another file
// (weaving only preserves in-file order).

const temporaryDirectories: string[] = [];

async function createSqlDirectory(
	files: Record<string, string>,
): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'sqlsmith-raw-diag-'));
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

describe('raw statement diagnostics', () => {
	it('reports raw passthrough as info and raw-only files as warning', async () => {
		const directory = await createSqlDirectory({
			'users.sql': [
				'CREATE TABLE users (id integer PRIMARY KEY);',
				'INSERT INTO users (id) VALUES (1);',
			].join('\n'),
			'zz_seed.sql': 'INSERT INTO users (id) VALUES (2);',
		});

		const plan = new SqlMerger().planDirectory(directory, 'postgresql');

		expect(plan.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'RAW_STATEMENTS', severity: 'info' }),
				expect.objectContaining({
					code: 'RAW_ONLY_FILE',
					severity: 'warning',
				}),
			]),
		);
	});

	it('warns when a raw statement references a relation defined in another file', async () => {
		const directory = await createSqlDirectory({
			'audit.sql': [
				'CREATE TABLE audit (id integer PRIMARY KEY);',
				'INSERT INTO users (id) VALUES (1);',
			].join('\n'),
			'users.sql': 'CREATE TABLE users (id integer PRIMARY KEY);',
		});

		const plan = new SqlMerger().planDirectory(directory, 'postgresql');
		const crossFile = plan.diagnostics.filter(
			(diagnostic) => diagnostic.code === 'RAW_CROSS_FILE_REFERENCE',
		);

		expect(crossFile).toHaveLength(1);
		expect(crossFile[0]).toMatchObject({
			code: 'RAW_CROSS_FILE_REFERENCE',
			severity: 'warning',
			statementName: 'audit.sql#2',
			dependencyName: 'users',
			dependencyKey: '["relation","public","users"]',
		});
		expect(crossFile[0]).toMatchObject({
			filePath: expect.stringContaining('audit.sql'),
			definitionFilePath: expect.stringContaining('users.sql'),
		});
	});

	it('does not warn when a raw statement only references relations from its own file', async () => {
		const directory = await createSqlDirectory({
			'users.sql': [
				'CREATE TABLE users (id integer PRIMARY KEY);',
				'INSERT INTO users (id) VALUES (1);',
			].join('\n'),
		});

		const plan = new SqlMerger().planDirectory(directory, 'postgresql');

		expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
			'RAW_CROSS_FILE_REFERENCE',
		);
	});

	it('marks external references as warnings', () => {
		const plan = new SqlMerger({
			allowExternalReferences: true,
		}).planDirectory(
			resolve(
				process.cwd(),
				'test/fixtures/postgresql/invalid/missing_dependency',
			),
			'postgresql',
		);

		expect(plan.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'EXTERNAL_REFERENCE',
					severity: 'warning',
				}),
			]),
		);
	});
});

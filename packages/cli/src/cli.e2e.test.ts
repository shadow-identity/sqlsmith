import { execFile } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { SUPPORTED_DIALECTS } from '@sqlsmith/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, '../dist/cli.js');
const FIXTURES = resolve(HERE, '../../core/test/fixtures/postgresql');

type CliResult = {
	stdout: string;
	stderr: string;
	exitCode: number;
};

const runCli = async (args: string[]): Promise<CliResult> => {
	try {
		const { stdout, stderr } = await execFileAsync('node', [CLI, ...args]);
		return { stdout, stderr, exitCode: 0 };
	} catch (error) {
		const failure = error as {
			stdout?: string;
			stderr?: string;
			code?: number;
		};
		return {
			stdout: failure.stdout ?? '',
			stderr: failure.stderr ?? '',
			exitCode: failure.code ?? 1,
		};
	}
};

const countOccurrences = (text: string, needle: string): number =>
	text.split(needle).length - 1;

const LOG_MARKERS = [
	'🔍',
	'✅',
	'📋',
	'📄',
	'🔗',
	'Dependency Graph',
	'Merge successful',
	'SQL Merger',
];

/**
 * CLI process contract:
 * - stdout carries ONLY program output (merged SQL) so `sqlsmith dir > out.sql`
 *   yields a clean, executable SQL file;
 * - human-facing logs go to stderr;
 * - exit codes reflect the error category (2 = input, 3 = dependency).
 */
describe('sqlsmith CLI (end-to-end)', () => {
	let scratchDir: string;
	let emptyDir: string;
	let malformedDir: string;
	let notDirectory: string;
	let tenantDir: string;

	beforeAll(() => {
		if (!existsSync(CLI)) {
			throw new Error(
				`CLI is not built (${CLI} missing). Run \`pnpm build\` before running e2e tests.`,
			);
		}
		scratchDir = mkdtempSync(join(tmpdir(), 'sqlsmith-e2e-'));
		emptyDir = join(scratchDir, 'empty');
		malformedDir = join(scratchDir, 'malformed');
		notDirectory = join(scratchDir, 'not-a-directory.sql');
		tenantDir = join(scratchDir, 'tenant');
		mkdirSync(emptyDir);
		mkdirSync(malformedDir);
		mkdirSync(tenantDir);
		writeFileSync(notDirectory, 'CREATE TABLE valid (id int);\n', 'utf8');
		writeFileSync(
			join(malformedDir, 'broken.sql'),
			'CREATE TABLE valid (id int);\n\nCREATE TABLE broken (;\n',
			'utf8',
		);
		writeFileSync(
			join(tenantDir, 'users.sql'),
			'CREATE TABLE tenant.users (id int PRIMARY KEY);\n',
			'utf8',
		);
		writeFileSync(
			join(tenantDir, 'orders.sql'),
			'CREATE TABLE tenant.orders (user_id int REFERENCES users(id));\n',
			'utf8',
		);
	});

	afterAll(() => {
		rmSync(scratchDir, { recursive: true, force: true });
	});

	// C6C-REGISTRY / R6C-02
	it('advertises the dialects from the core registry', async () => {
		const { stdout, exitCode } = await runCli(['--help']);

		expect(exitCode).toBe(0);
		expect(stdout).toContain(`SQL dialect (${SUPPORTED_DIALECTS.join(', ')})`);
		expect(stdout).not.toContain('bigquery');
	});

	describe('merge to stdout (default)', () => {
		it('emits only SQL on stdout and logs on stderr', async () => {
			const { stdout, stderr, exitCode } = await runCli([
				join(FIXTURES, 'correct/single_foreign_keys'),
			]);

			expect(exitCode).toBe(0);
			expect(stdout).toContain('CREATE TABLE');
			for (const marker of LOG_MARKERS) {
				expect(stdout).not.toContain(marker);
			}
			// Progress reporting must still exist — on stderr
			expect(stderr.length).toBeGreaterThan(0);
		});

		it('produces stdout where every line is SQL or a SQL comment', async () => {
			const { stdout, exitCode } = await runCli([
				join(FIXTURES, 'correct/base_tables'),
			]);

			expect(exitCode).toBe(0);
			const offendingLines = stdout
				.split('\n')
				.filter((line) => line.trim() !== '')
				.filter(
					(line) =>
						!line.startsWith('--') &&
						!/^[A-Za-z_("')\s]/.test(line) &&
						!/^\);?$/.test(line.trim()),
				);
			expect(offendingLines).toEqual([]);
		});
	});

	describe('merge to file (--output)', () => {
		it('writes the SQL to the file and keeps stdout empty', async () => {
			const outputPath = join(scratchDir, 'merged.sql');
			const { stdout, exitCode } = await runCli([
				join(FIXTURES, 'correct/single_foreign_keys'),
				'--output',
				outputPath,
			]);

			expect(exitCode).toBe(0);
			expect(existsSync(outputPath)).toBe(true);
			expect(readFileSync(outputPath, 'utf-8')).toContain('CREATE TABLE');
			expect(stdout.trim()).toBe('');
		});
	});

	describe('info and validate commands', () => {
		// C4-CLI / R4-02 / R4-04 / R4-05
		it('info reports to stderr, not stdout', async () => {
			const { stdout, stderr, exitCode } = await runCli([
				'info',
				join(FIXTURES, 'correct/single_foreign_keys'),
			]);

			expect(exitCode).toBe(0);
			expect(stdout.trim()).toBe('');
			expect(stderr).toContain('Dependency Graph');
			expect(stderr).toContain('Recommended execution order');
			expect(stderr).not.toContain('["relation"');
		});

		it('validate reports to stderr, not stdout', async () => {
			const { stdout, stderr, exitCode } = await runCli([
				'validate',
				join(FIXTURES, 'correct/base_tables'),
			]);

			expect(exitCode).toBe(0);
			expect(stdout.trim()).toBe('');
			expect(stderr).toContain('SQL Validator');
			expect(stderr).toContain('Ready for merging');
		});
	});

	describe('canonical identifiers', () => {
		it('applies --default-schema to unqualified PostgreSQL references', async () => {
			const { stdout, stderr, exitCode } = await runCli([
				tenantDir,
				'--default-schema',
				'tenant',
			]);

			expect(exitCode).toBe(0);
			expect(stdout.indexOf('CREATE TABLE tenant.users')).toBeLessThan(
				stdout.indexOf('CREATE TABLE tenant.orders'),
			);
			expect(stderr).not.toContain('["relation"');
		});
	});

	describe('statement-level ordering', () => {
		it('emits interleaved cross-file dependencies in the correct order', async () => {
			const { stdout, exitCode } = await runCli([
				join(FIXTURES, 'correct/interleaved_dependencies'),
			]);

			expect(exitCode).toBe(0);
			const posX = stdout.indexOf('CREATE TABLE x');
			const posY = stdout.indexOf('CREATE TABLE y');
			const posZ = stdout.indexOf('CREATE TABLE z');
			expect(posX).toBeGreaterThanOrEqual(0);
			expect(posX).toBeLessThan(posY);
			expect(posY).toBeLessThan(posZ);
		});

		it('reorders out-of-order files with --no-validate-source-order', async () => {
			const { stdout, exitCode } = await runCli([
				join(FIXTURES, 'invalid/bad_statement_order'),
				'--no-validate-source-order',
			]);

			expect(exitCode).toBe(0);
			expect(stdout.indexOf('CREATE TABLE countries')).toBeLessThan(
				stdout.indexOf('CREATE TABLE cities'),
			);
		});
	});

	describe('missing dependencies', () => {
		it('exits with 3 when a FK references an unknown table', async () => {
			const { exitCode, stderr } = await runCli([
				join(FIXTURES, 'invalid/missing_dependency'),
			]);

			expect(exitCode).toBe(3);
			expect(stderr).toContain('customers');
		});

		it('merges with --allow-external-references', async () => {
			const { stdout, stderr, exitCode } = await runCli([
				join(FIXTURES, 'invalid/missing_dependency'),
				'--allow-external-references',
			]);

			expect(exitCode).toBe(0);
			expect(stdout).toContain('CREATE TABLE orders');
			expect(stderr).toContain('External reference');
		});

		it('renders raw passthrough diagnostics at the CLI boundary', async () => {
			const { stdout, stderr, exitCode } = await runCli([
				join(FIXTURES, 'correct/raw_statements'),
			]);

			expect(exitCode).toBe(0);
			expect(stdout).toContain('CREATE INDEX idx_users_name');
			expect(stderr).toContain('unrecognized statement(s)');
		});
	});

	describe('exit codes', () => {
		it('exits with 3 for circular dependencies', async () => {
			const { exitCode, stderr } = await runCli([
				join(FIXTURES, 'invalid/circular_dependency'),
			]);

			expect(exitCode).toBe(3);
			expect(stderr).toContain('Circular');
		});

		it('exits with 2 for a missing input directory', async () => {
			const { exitCode, stdout, stderr } = await runCli([
				join(FIXTURES, 'does_not_exist'),
			]);

			expect(exitCode).toBe(2);
			expect(stdout.trim()).toBe('');
			expect(countOccurrences(stderr, '[DIRECTORY_NOT_FOUND]')).toBe(1);
		});

		// C3-LOG-ONCE / C3-EXIT-MATRIX / R3-03 / R3-04 / R3-05
		it.each([
			{
				name: 'malformed SQL',
				args: () => [malformedDir],
				exitCode: 1,
				sentinel: '[INVALID_SQL_SYNTAX]',
			},
			{
				name: 'empty input directory',
				args: () => [emptyDir],
				exitCode: 2,
				sentinel: '[NO_SQL_FILES]',
			},
			{
				name: 'input path that is not a directory',
				args: () => [notDirectory],
				exitCode: 2,
				sentinel: '[NOT_A_DIRECTORY]',
			},
			{
				name: 'output write failure',
				args: () => [join(FIXTURES, 'correct/base_tables'), '-o', scratchDir],
				exitCode: 2,
				sentinel: '[FILE_WRITE_FAILED]',
			},
			{
				name: 'invalid source order',
				args: () => [join(FIXTURES, 'invalid/bad_statement_order')],
				exitCode: 3,
				sentinel: '[INVALID_STATEMENT_ORDER]',
			},
			{
				name: 'invalid dialect',
				args: () => [
					join(FIXTURES, 'correct/base_tables'),
					'--dialect',
					'oracle',
				],
				exitCode: 4,
				sentinel: '[INVALID_OPTIONS]',
			},
		])('$name has one boundary diagnostic', async (testCase) => {
			const { exitCode, stdout, stderr } = await runCli(testCase.args());

			expect(exitCode).toBe(testCase.exitCode);
			expect(stdout).toBe('');
			expect(countOccurrences(stderr, testCase.sentinel)).toBe(1);
		});
	});
});

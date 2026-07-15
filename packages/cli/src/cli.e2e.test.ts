import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
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

	beforeAll(() => {
		if (!existsSync(CLI)) {
			throw new Error(
				`CLI is not built (${CLI} missing). Run \`pnpm build\` before running e2e tests.`,
			);
		}
		scratchDir = mkdtempSync(join(tmpdir(), 'sqlsmith-e2e-'));
	});

	afterAll(() => {
		rmSync(scratchDir, { recursive: true, force: true });
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
		it('info reports to stderr, not stdout', async () => {
			const { stdout, exitCode } = await runCli([
				'info',
				join(FIXTURES, 'correct/single_foreign_keys'),
			]);

			expect(exitCode).toBe(0);
			expect(stdout.trim()).toBe('');
		});

		it('validate reports to stderr, not stdout', async () => {
			const { stdout, exitCode } = await runCli([
				'validate',
				join(FIXTURES, 'correct/base_tables'),
			]);

			expect(exitCode).toBe(0);
			expect(stdout.trim()).toBe('');
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

		it('exits non-zero for a missing input directory', async () => {
			const { exitCode, stdout } = await runCli([
				join(FIXTURES, 'does_not_exist'),
			]);

			expect(exitCode).not.toBe(0);
			expect(stdout.trim()).toBe('');
		});
	});
});

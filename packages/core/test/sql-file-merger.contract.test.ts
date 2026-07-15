import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqlMerger } from '../src/sql-merger.js';

vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	return {
		...actual,
		writeFileSync: vi.fn(),
	};
});

/**
 * Core contract: merging is a pure computation. `mergeFiles` returns the
 * merged SQL as a string and must not write to stdout or to the file system —
 * delivering the result is the caller's (CLI, vite-plugin) responsibility.
 */
describe('SqlFileMerger side-effect contract', () => {
	const fixturePath = resolve(
		process.cwd(),
		'test/fixtures/postgresql/correct/single_foreign_keys',
	);

	afterEach(() => {
		vi.restoreAllMocks();
		vi.mocked(writeFileSync).mockClear();
	});

	it('returns the merged SQL without writing to stdout', () => {
		const merger = new SqlMerger();
		const sqlFiles = merger.parseSqlFiles(fixturePath, 'postgresql');

		const stdoutSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation(() => true);

		const merged = merger.mergeFiles(sqlFiles);

		expect(merged).toContain('CREATE TABLE');
		expect(stdoutSpy).not.toHaveBeenCalled();
	});

	it('never writes to the file system', () => {
		const merger = new SqlMerger();
		const sqlFiles = merger.parseSqlFiles(fixturePath, 'postgresql');

		vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
		merger.mergeFiles(sqlFiles);

		expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled();
	});
});

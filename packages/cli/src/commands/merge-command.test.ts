import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	executeMergeCommand,
	type MergeCommandOptions,
} from './merge-command.js';

// Mock external dependencies
vi.mock('@sqlsmith/core', () => ({
	ServiceContainer: vi.fn(),
	SqlMerger: {
		withContainer: vi.fn(),
	},
}));

vi.mock('node:fs', () => ({
	writeFileSync: vi.fn(),
}));

vi.mock('node:path', () => ({
	resolve: vi.fn(),
}));

/**
 * Command contract: the merge command owns result delivery. The core merger
 * only computes the merged SQL string; the command writes it to the requested
 * file, or to stdout when no output path is given.
 */
describe('executeMergeCommand', () => {
	const MERGED_SQL = '-- merged\nCREATE TABLE fake ();\n';

	const mockLogger = {
		info: vi.fn(),
		success: vi.fn(),
	};

	const mockMerger = {
		parseSqlFiles: vi.fn(),
		mergeFiles: vi.fn(),
	};

	const mockContainer = {
		getLogger: vi.fn(() => mockLogger),
	};

	const MockedServiceContainer = vi.mocked(ServiceContainer);
	const MockedSqlMerger = vi.mocked(SqlMerger);
	const mockedResolve = vi.mocked(resolve);
	const mockedWriteFileSync = vi.mocked(writeFileSync);

	let stdoutSpy: ReturnType<typeof vi.spyOn>;

	const defaultOptions: MergeCommandOptions = {
		dialect: 'postgresql' as SqlDialect,
		logLevel: 'info' as LogLevel,
		output: 'output.sql',
	};

	beforeEach(() => {
		vi.resetAllMocks();

		MockedServiceContainer.mockImplementation(
			class {
				getLogger = mockContainer.getLogger;
			} as any,
		);
		MockedSqlMerger.withContainer.mockReturnValue(mockMerger as any);
		mockedResolve.mockImplementation((path: string) => `/resolved/${path}`);
		mockContainer.getLogger.mockImplementation(() => mockLogger);
		mockMerger.parseSqlFiles.mockReturnValue([{ id: 'file1' }]);
		mockMerger.mergeFiles.mockReturnValue(MERGED_SQL);

		stdoutSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('result delivery', () => {
		it('writes the merged SQL to the output file when output is provided', async () => {
			await executeMergeCommand('./in', {
				...defaultOptions,
				output: '/tmp/merged.sql',
			});

			expect(mockedWriteFileSync).toHaveBeenCalledWith(
				'/tmp/merged.sql',
				MERGED_SQL,
				'utf-8',
			);
			expect(stdoutSpy).not.toHaveBeenCalled();
		});

		it('writes the merged SQL to stdout when no output is provided', async () => {
			await executeMergeCommand('./in', {
				...defaultOptions,
				output: undefined,
			});

			expect(mockedWriteFileSync).not.toHaveBeenCalled();
			const stdout = stdoutSpy.mock.calls
				.map((call) => String(call[0]))
				.join('');
			expect(stdout).toContain(MERGED_SQL);
		});

		it('does not pass output handling down to the core merger', async () => {
			await executeMergeCommand('./in', defaultOptions);

			const [, mergeOptions] = mockMerger.mergeFiles.mock.calls[0];
			expect(mergeOptions).not.toHaveProperty('outputPath');
		});
	});

	describe('core invocation', () => {
		it('creates the container with logger options and parses the resolved input', async () => {
			await executeMergeCommand('./my-dir', defaultOptions);

			expect(MockedServiceContainer).toHaveBeenCalledWith(
				expect.objectContaining({
					loggerOptions: { logLevel: 'info' },
				}),
			);
			expect(mockedResolve).toHaveBeenCalledWith('./my-dir');
			expect(MockedSqlMerger.withContainer).toHaveBeenCalledWith(
				MockedServiceContainer.mock.instances[0],
			);
			expect(mockMerger.parseSqlFiles).toHaveBeenCalledWith(
				'/resolved/./my-dir',
				'postgresql',
			);
		});

		it('merges the parsed files with presentation options', async () => {
			const sqlFiles = [{ id: 'file1' }];
			mockMerger.parseSqlFiles.mockReturnValue(sqlFiles);

			await executeMergeCommand('./in', defaultOptions);

			expect(mockMerger.mergeFiles).toHaveBeenCalledWith(
				sqlFiles,
				expect.objectContaining({
					addComments: true,
					includeHeader: true,
					separateStatements: true,
				}),
			);
		});
	});
});

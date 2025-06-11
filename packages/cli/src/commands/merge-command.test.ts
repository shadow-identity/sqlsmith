import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('node:path', () => ({
	resolve: vi.fn(),
}));

describe('executeMergeCommand', () => {
	// Mock instances
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

	// Cast mocks for better type safety
	const MockedServiceContainer = vi.mocked(ServiceContainer);
	const MockedSqlMerger = vi.mocked(SqlMerger);
	const mockedResolve = vi.mocked(resolve);

	const defaultOptions: MergeCommandOptions = {
		dialect: 'postgresql' as SqlDialect,
		logLevel: 'info' as LogLevel,
		output: 'output.sql',
		allowReorderDropComments: false,
	};

	beforeEach(() => {
		// Reset all mocks (including implementations) before each test
		vi.resetAllMocks();

		// Setup default mock implementations
		MockedServiceContainer.mockImplementation(() => mockContainer as any);
		MockedSqlMerger.withContainer.mockReturnValue(mockMerger as any);
		mockedResolve.mockImplementation((path: string) => `/resolved/${path}`);

		// Restore container method implementations after reset
		mockContainer.getLogger.mockImplementation(() => mockLogger);
	});

	describe('successful execution', () => {
		it('should execute successfully with valid inputs', async () => {
			const inputPath = './test-directory';
			const mockSqlFiles = [{ id: 'file1', content: 'CREATE TABLE test...' }];
			mockMerger.parseSqlFiles.mockReturnValue(mockSqlFiles);

			await executeMergeCommand(inputPath, defaultOptions);

			// Verify ServiceContainer is created with correct options
			expect(MockedServiceContainer).toHaveBeenCalledWith({
				loggerOptions: {
					logLevel: 'info',
				},
				allowReorderDropComments: false,
			});

			// Verify path resolution
			expect(mockedResolve).toHaveBeenCalledWith(inputPath);

			// Verify merger creation and calls
			expect(MockedSqlMerger.withContainer).toHaveBeenCalledWith(mockContainer);
			expect(mockMerger.parseSqlFiles).toHaveBeenCalledWith(
				'/resolved/./test-directory',
				'postgresql',
			);
			expect(mockMerger.mergeFiles).toHaveBeenCalledWith(mockSqlFiles, {
				addComments: true,
				includeHeader: true,
				separateStatements: true,
				outputPath: 'output.sql',
			});

			// Verify logging
			expect(mockLogger.info).toHaveBeenCalledWith('🔧 SQL Merger');
			expect(mockLogger.success).toHaveBeenCalledWith(
				'Merge completed successfully',
			);
		});

		it('should handle undefined output path', async () => {
			const inputPath = './test-directory';
			const optionsWithoutOutput = { ...defaultOptions, output: undefined };
			const mockSqlFiles = [{ id: 'file1', content: 'CREATE TABLE test...' }];
			mockMerger.parseSqlFiles.mockReturnValue(mockSqlFiles);

			await executeMergeCommand(inputPath, optionsWithoutOutput);

			expect(mockMerger.mergeFiles).toHaveBeenCalledWith(mockSqlFiles, {
				addComments: true,
				includeHeader: true,
				separateStatements: true,
				outputPath: undefined,
			});
		});

		it('should pass allowReorderDropComments to ServiceContainer', async () => {
			const inputPath = './test-directory';
			const optionsWithReorder = {
				...defaultOptions,
				allowReorderDropComments: true,
			};

			await executeMergeCommand(inputPath, optionsWithReorder);

			expect(MockedServiceContainer).toHaveBeenCalledWith({
				loggerOptions: {
					logLevel: 'info',
				},
				allowReorderDropComments: true,
			});
		});
	});

	describe('integration flow', () => {
		it('should execute operations in the correct order', async () => {
			const callOrder: string[] = [];
			const mockSqlFiles = [{ id: 'file1' }];

			MockedServiceContainer.mockImplementation(() => {
				callOrder.push('ServiceContainer');
				return mockContainer as any;
			});

			mockContainer.getLogger.mockImplementation(() => {
				callOrder.push('getLogger');
				return mockLogger;
			});

			mockLogger.info.mockImplementation(() => {
				callOrder.push('logger.info');
			});

			mockedResolve.mockImplementation((path: string) => {
				callOrder.push('resolve');
				return `/resolved/${path}`;
			});

			MockedSqlMerger.withContainer.mockImplementation(() => {
				callOrder.push('SqlMerger.withContainer');
				return mockMerger as any;
			});

			mockMerger.parseSqlFiles.mockImplementation(() => {
				callOrder.push('parseSqlFiles');
				return mockSqlFiles as any;
			});

			mockMerger.mergeFiles.mockImplementation(() => {
				callOrder.push('mergeFiles');
			});

			mockLogger.success.mockImplementation(() => {
				callOrder.push('logger.success');
			});

			await executeMergeCommand('./test', defaultOptions);

			expect(callOrder).toEqual([
				'ServiceContainer',
				'getLogger',
				'logger.info',
				'resolve',
				'SqlMerger.withContainer',
				'parseSqlFiles',
				'mergeFiles',
				'logger.success',
			]);
		});
	});
});

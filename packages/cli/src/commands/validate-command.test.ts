import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	executeValidateCommand,
	type ValidateCommandOptions,
} from './validate-command.js';

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

describe('executeValidateCommand', () => {
	// Mock instances
	const mockLogger = {
		error: vi.fn(),
	};

	const mockMerger = {
		validateFiles: vi.fn(),
	};

	const mockContainer = {
		getLogger: vi.fn(() => mockLogger),
	};

	// Cast mocks for better type safety
	const MockedServiceContainer = vi.mocked(ServiceContainer);
	const MockedSqlMerger = vi.mocked(SqlMerger);
	const mockedResolve = vi.mocked(resolve);

	const defaultOptions: ValidateCommandOptions = {
		dialect: 'postgresql' as SqlDialect,
		logLevel: 'info' as LogLevel,
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
			mockMerger.validateFiles.mockResolvedValue(undefined); // Success case

			await executeValidateCommand(inputPath, defaultOptions);

			// Verify ServiceContainer is created with correct options
			expect(MockedServiceContainer).toHaveBeenCalledWith({
				loggerOptions: {
					logLevel: 'info',
				},
			});

			// Verify path resolution
			expect(mockedResolve).toHaveBeenCalledWith(inputPath);

			// Verify merger creation and validation call
			expect(MockedSqlMerger.withContainer).toHaveBeenCalledWith(mockContainer);
			expect(mockMerger.validateFiles).toHaveBeenCalledWith(
				'/resolved/./test-directory',
				'postgresql',
			);

			// Ensure no error was logged
			expect(mockLogger.error).not.toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should log an error and re-throw when validation fails', async () => {
			const inputPath = './test-directory';
			const validationError = new Error('Validation failed');
			mockMerger.validateFiles.mockRejectedValue(validationError);

			await expect(
				executeValidateCommand(inputPath, defaultOptions),
			).rejects.toThrow(validationError);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Validation failed: Validation failed',
			);
		});

		it('should handle non-Error objects being thrown', async () => {
			const inputPath = './test-directory';
			const validationError = 'A string error';
			mockMerger.validateFiles.mockRejectedValue(validationError);

			await expect(
				executeValidateCommand(inputPath, defaultOptions),
			).rejects.toBe(validationError);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Validation failed: A string error',
			);
		});
	});

	describe('integration flow', () => {
		it('should execute operations in the correct order', async () => {
			const callOrder: string[] = [];
			mockMerger.validateFiles.mockResolvedValue(undefined);

			MockedServiceContainer.mockImplementation(() => {
				callOrder.push('ServiceContainer');
				return mockContainer as any;
			});

			mockContainer.getLogger.mockImplementation(() => {
				callOrder.push('getLogger');
				return mockLogger;
			});

			mockedResolve.mockImplementation((path: string) => {
				callOrder.push('resolve');
				return `/resolved/${path}`;
			});

			MockedSqlMerger.withContainer.mockImplementation(() => {
				callOrder.push('SqlMerger.withContainer');
				return mockMerger as any;
			});

			mockMerger.validateFiles.mockImplementation(() => {
				callOrder.push('validateFiles');
				return Promise.resolve();
			});

			await executeValidateCommand('./test', defaultOptions);

			expect(callOrder).toEqual([
				'ServiceContainer',
				'getLogger',
				'resolve',
				'SqlMerger.withContainer',
				'validateFiles',
			]);
		});
	});
});

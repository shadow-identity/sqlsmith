import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeInfoCommand, type InfoCommandOptions } from './info-command.js';

// Mock external dependencies
vi.mock('@sqlsmith/core', () => ({
	ServiceContainer: vi.fn(),
	SqlMerger: {
		withContainer: vi.fn(),
	},
}));

vi.mock('path', () => ({
	resolve: vi.fn(),
}));

describe('executeInfoCommand', () => {
	// Mock instances
	const mockLogger = {
		error: vi.fn(),
		raw: vi.fn(),
	};

	const mockValidator = {
		validateInputDirectory: vi.fn(),
		validateDialect: vi.fn(),
	};

	const mockMerger = {
		analyzeDependencies: vi.fn(),
	};

	const mockContainer = {
		getLogger: vi.fn(() => mockLogger),
		getFileSystemValidator: vi.fn(() => mockValidator),
	};

	// Cast mocks for better type safety
	const MockedServiceContainer = vi.mocked(ServiceContainer);
	const MockedSqlMerger = vi.mocked(SqlMerger);
	const mockedResolve = vi.mocked(resolve);

	const defaultOptions: InfoCommandOptions = {
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
		mockContainer.getFileSystemValidator.mockImplementation(
			() => mockValidator,
		);

		// By default, validators succeed (no-op)
		mockValidator.validateInputDirectory.mockImplementation(() => {});
		mockValidator.validateDialect.mockImplementation(() => {});
	});

	describe('successful execution', () => {
		it('should execute successfully with valid inputs', async () => {
			const inputPath = './test-directory';

			await executeInfoCommand(inputPath, defaultOptions);

			// Verify ServiceContainer is created with correct options
			expect(MockedServiceContainer).toHaveBeenCalledWith({
				loggerOptions: {
					logLevel: 'info',
				},
			});

			// Verify path resolution
			expect(mockedResolve).toHaveBeenCalledWith(inputPath);

			// Verify merger creation and analysis
			expect(MockedSqlMerger.withContainer).toHaveBeenCalledWith(mockContainer);
			expect(mockMerger.analyzeDependencies).toHaveBeenCalledWith(
				'/resolved/./test-directory',
				'postgresql',
			);
		});
	});

	describe('integration flow', () => {
		it('should execute operations in the correct order', async () => {
			const callOrder: string[] = [];

			MockedServiceContainer.mockImplementation(() => {
				callOrder.push('ServiceContainer');
				return mockContainer as any;
			});

			mockContainer.getFileSystemValidator.mockImplementation(() => {
				callOrder.push('getFileSystemValidator');
				return mockValidator;
			});

			mockedResolve.mockImplementation((path: string) => {
				callOrder.push('resolve');
				return `/resolved/${path}`;
			});

			mockValidator.validateInputDirectory.mockImplementation(() => {
				callOrder.push('validateInputDirectory');
			});

			mockValidator.validateDialect.mockImplementation(() => {
				callOrder.push('validateDialect');
			});

			MockedSqlMerger.withContainer.mockImplementation(() => {
				callOrder.push('SqlMerger.withContainer');
				return mockMerger as any;
			});

			mockMerger.analyzeDependencies.mockImplementation(() => {
				callOrder.push('analyzeDependencies');
				return Promise.resolve();
			});

			await executeInfoCommand('./test', defaultOptions);

			expect(callOrder).toEqual([
				'ServiceContainer',
				'resolve',
				'SqlMerger.withContainer',
				'analyzeDependencies',
			]);
		});
	});
});

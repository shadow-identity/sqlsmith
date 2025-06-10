import * as fs from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	executeInfoCommand,
	executeMergeCommand,
	executeValidateCommand,
	type InfoCommandOptions,
	type MergeCommandOptions,
	type ValidateCommandOptions,
} from '../src/cli/commands/index.js';
import { createProgram } from '../src/cli.js';

// Mock console methods to capture output
let mockConsoleLog: any;
let mockConsoleError: any;
let mockProcessExit: any;
let mockSqlMergerInstance: any;
// Global variable to share mock instance
let globalMockSqlMergerInstance: any;

// Mock @sqlsmith/core
vi.mock('@sqlsmith/core', () => {
	// Create a shared mock instance that will be used by both constructor and withContainer
	const createMockInstance = () => ({
		parseSqlFile: vi.fn().mockReturnValue([]),
		topologicalSort: vi.fn().mockReturnValue([]),
		mergeFiles: vi.fn().mockReturnValue('merged SQL content'),
		findSqlFiles: vi.fn().mockReturnValue([]),
		parseSingleFile: vi.fn().mockReturnValue({}),
		buildDependencyGraph: vi.fn().mockReturnValue({}),
		detectCycles: vi.fn().mockReturnValue([]),
		visualizeDependencyGraph: vi.fn(),
		analyzeDependencies: vi.fn(),
		validateFiles: vi.fn(),
	});

	const MockSqlMerger = vi.fn(() => {
		if (!globalMockSqlMergerInstance) {
			globalMockSqlMergerInstance = createMockInstance();
		}
		return globalMockSqlMergerInstance;
	});

	// Add static method that returns the same shared instance
	(MockSqlMerger as any).withContainer = vi.fn(() => {
		if (!globalMockSqlMergerInstance) {
			globalMockSqlMergerInstance = createMockInstance();
		}
		return globalMockSqlMergerInstance;
	});

	const MockServiceContainer = vi.fn((options?: any) => ({
		getLogger: vi.fn(() => ({
			info: vi.fn((msg: string) => {
				if (!options?.loggerOptions?.quiet) {
					console.log(msg);
				}
			}),
			warn: vi.fn((msg: string) => console.log(msg)),
			error: vi.fn((msg: string) => console.error(msg)),
			debug: vi.fn((msg: string) => console.log(msg)),
			success: vi.fn((msg: string) => console.log(msg)),
			raw: vi.fn((msg: string) => console.log(msg)),
		})),
		getFileSystemValidator: vi.fn(() => ({
			validateInputDirectory: vi.fn((path: string) => {
				if (!fs.existsSync(path)) {
					throw new Error(`Input directory does not exist: ${path}`);
				}
				const stats = fs.statSync(path);
				if (!stats.isDirectory()) {
					throw new Error(`Input path is not a directory: ${path}`);
				}
			}),
			validateOutputDirectory: vi.fn((path: string) => {
				const dir = require('path').dirname(path);
				if (!fs.existsSync(dir)) {
					throw new Error(`Output directory does not exist: ${dir}`);
				}
			}),
			validateDialect: vi.fn((dialect: string) => {
				const supported = ['postgresql', 'mysql', 'sqlite', 'bigquery'];
				if (!supported.includes(dialect)) {
					throw new Error(`Invalid dialect: ${dialect}. Supported dialects: ${supported.join(', ')}`);
				}
			}),
		})),
		getSqlMerger: vi.fn(() => new MockSqlMerger()),
		getErrorHandler: vi.fn(() => ({
			handle: vi.fn(),
		})),
	}));

	const MockConfigurationError = class extends Error {
		static invalidOptions(field: string, message: string): Error {
			return new Error(`Invalid ${field}: ${message}`);
		}
	};

	return {
		SqlMerger: MockSqlMerger,
		ServiceContainer: MockServiceContainer,
		ErrorHandler: vi.fn(),
		Logger: vi.fn(),
		ConfigurationError: MockConfigurationError,
		// Re-export types (they don't need mocking)
		type: {
			SqlFile: {} as any,
			SqlDialect: {} as any,
		},
	};
});

// Mock fs module
vi.mock('fs', () => ({
	existsSync: vi.fn(),
	statSync: vi.fn(),
	readFileSync: vi.fn().mockReturnValue('{"version": "0.2.0"}'),
	unlinkSync: vi.fn(),
}));

// CLI validation function that was in the original
const validateInputDirectory = (inputPath: string): void => {
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input directory does not exist: ${inputPath}`);
	}

	const stats = fs.statSync(inputPath);
	if (!stats.isDirectory()) {
		throw new Error(`Input path is not a directory: ${inputPath}`);
	}

	// Try to read directory - use mocked SqlMerger
	try {
		if (mockSqlMergerInstance && mockSqlMergerInstance.findSqlFiles) {
			mockSqlMergerInstance.findSqlFiles(inputPath);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Cannot read input directory: ${message}`);
	}
};

// Type definitions that match the original CLI
type CliOptions = MergeCommandOptions;
type InfoOptions = InfoCommandOptions;
type ValidateOptions = ValidateCommandOptions;

// Command aliases to match original test expectations
const mergeCommand = executeMergeCommand;
const infoCommand = executeInfoCommand;
const validateCommand = executeValidateCommand;

describe('CLI Interface', () => {
	beforeEach(() => {
		// Setup console spies before other mocks
		mockConsoleLog = vi.spyOn(console, 'log');
		mockConsoleError = vi.spyOn(console, 'error');
		mockProcessExit = vi
			.spyOn(process, 'exit')
			.mockImplementation((code?: number | string | null | undefined) => {
				throw new Error(`process.exit unexpectedly called with "${code}"`);
			});

		// Ensure global mock instance is created
		if (!globalMockSqlMergerInstance) {
			globalMockSqlMergerInstance = {
				parseSqlFile: vi.fn().mockReturnValue([]),
				topologicalSort: vi.fn().mockReturnValue([]),
				mergeFiles: vi.fn().mockReturnValue('merged SQL content'),
				findSqlFiles: vi.fn().mockReturnValue([]),
				parseSingleFile: vi.fn().mockReturnValue({}),
				buildDependencyGraph: vi.fn().mockReturnValue({}),
				detectCycles: vi.fn().mockReturnValue([]),
				visualizeDependencyGraph: vi.fn(),
				analyzeDependencies: vi.fn(),
				validateFiles: vi.fn(),
			};
		}

		// Use the global mock instance
		mockSqlMergerInstance = globalMockSqlMergerInstance;

		// Clear all mock call counts
		Object.values(mockSqlMergerInstance).forEach((mock: any) => {
			if (typeof mock.mockClear === 'function') {
				mock.mockClear();
			}
		});

		// Mock fs by default to simulate valid directory
		(fs.existsSync as any).mockReturnValue(true);
		(fs.statSync as any).mockReturnValue({ isDirectory: () => true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Program Creation', () => {
		it('should create program with correct configuration', () => {
			const program = createProgram();

			expect(program.name()).toBe('sqlsmith');
			expect(program.description()).toBe(
				'A tool for merging SQL files with dependency resolution',
			);
			expect(program.version()).toBe('0.2.0');
		});
	});

	describe('Input Directory Validation', () => {
		it('should validate existing directory successfully', () => {
			mockSqlMergerInstance.findSqlFiles.mockReturnValue(['/path/to/file.sql']);

			expect(() => validateInputDirectory('/valid/path')).not.toThrow();
			expect(fs.existsSync).toHaveBeenCalledWith('/valid/path');
			expect(fs.statSync).toHaveBeenCalledWith('/valid/path');
		});

		it('should throw error for non-existent directory', () => {
			(fs.existsSync as any).mockReturnValue(false);

			expect(() => validateInputDirectory('/invalid/path')).toThrow(
				'Input directory does not exist: /invalid/path',
			);
		});

		it('should throw error for non-directory path', () => {
			(fs.statSync as any).mockReturnValue({ isDirectory: () => false });

			expect(() => validateInputDirectory('/file/path')).toThrow(
				'Input path is not a directory: /file/path',
			);
		});

		it('should throw error for unreadable directory', () => {
			mockSqlMergerInstance.findSqlFiles.mockImplementation(() => {
				throw new Error('Permission denied');
			});

			expect(() => validateInputDirectory('/unreadable/path')).toThrow(
				'Cannot read input directory: Permission denied',
			);
		});
	});

	describe('Merge Command', () => {
		const mockSqlFiles: any[] = [
			{
				path: '/test/foo.sql',
				content: 'CREATE TABLE foo (a INT);',
				dependencies: [
					{
						tableName: 'foo',
						dependsOn: [] as string[],
					},
				],
			},
			{
				path: '/test/bar.sql',
				content: 'CREATE TABLE bar (b INT, FOREIGN KEY (b) REFERENCES foo(a));',
				dependencies: [
					{
						tableName: 'bar',
						dependsOn: ['foo'] as string[],
					},
				],
			},
		];

		it('should execute merge command successfully', async () => {
			const options: CliOptions = {
				dialect: 'postgresql',
				comments: true,
				header: true,
				separate: true,
				quiet: false,
				verbose: false,
				allowReorderDropComments: false,
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.mergeFiles.mockReturnValue('merged SQL content');

			await mergeCommand('/test/input', options);

			expect(mockSqlMergerInstance.parseSqlFile).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
			);
			expect(mockSqlMergerInstance.mergeFiles).toHaveBeenCalledWith(
				mockSqlFiles,
				{
					addComments: true,
					includeHeader: true,
					separateStatements: true,
					outputPath: undefined,
				},
			);
			expect(mockConsoleLog).toHaveBeenCalledWith('🔧 SQL Merger');
		});

		it('should handle quiet mode correctly', async () => {
			const options: CliOptions = {
				dialect: 'postgresql',
				comments: true,
				header: true,
				separate: true,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false,
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.mergeFiles.mockReturnValue('merged SQL content');

			await mergeCommand('/test/input', options);

			// Should not log the header in quiet mode
			expect(mockConsoleLog).not.toHaveBeenCalledWith('🔧 SQL Merger');
			expect(mockSqlMergerInstance.parseSqlFile).toHaveBeenCalled();
			expect(mockSqlMergerInstance.mergeFiles).toHaveBeenCalled();
		});

		it('should validate output directory when output path provided', async () => {
			const options: CliOptions = {
				output: '/valid/output.sql',
				dialect: 'postgresql',
				comments: true,
				header: true,
				separate: true,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false,
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.mergeFiles.mockReturnValue('merged SQL content');

			await mergeCommand('/test/input', options);

			expect(fs.existsSync).toHaveBeenCalledWith(resolve('/valid'));
			expect(mockSqlMergerInstance.mergeFiles).toHaveBeenCalledWith(
				mockSqlFiles,
				expect.objectContaining({
					outputPath: '/valid/output.sql',
				}),
			);
		});

		it('should throw error for invalid output directory', async () => {
			const options: CliOptions = {
				output: '/invalid/dir/output.sql',
				dialect: 'postgresql',
				comments: true,
				header: true,
				separate: true,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false,
			};

			// Mock output directory as non-existent
			(fs.existsSync as any).mockImplementation((path: string) => {
				return !path.includes('/invalid/dir');
			});

			await expect(mergeCommand('/test/input', options)).rejects.toThrow(
				'Output directory does not exist',
			);
		});

		it('should reject invalid SQL dialect', async () => {
			const options: CliOptions = {
				dialect: 'invalid-dialect',
				comments: true,
				header: true,
				separate: true,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false,
			};

			await expect(mergeCommand('/test/input', options)).rejects.toThrow(
				'Invalid dialect: invalid-dialect. Supported dialects: postgresql, mysql, sqlite, bigquery',
			);
		});

		it('should handle merge options correctly', async () => {
			const options: CliOptions = {
				dialect: 'mysql',
				comments: false,
				header: false,
				separate: false,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false,
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.mergeFiles.mockReturnValue('merged SQL content');

			await mergeCommand('/test/input', options);

			expect(mockSqlMergerInstance.mergeFiles).toHaveBeenCalledWith(
				mockSqlFiles,
				{
					addComments: false,
					includeHeader: false,
					separateStatements: false,
					outputPath: undefined,
				},
			);
		});
	});

	describe('Info Command', () => {
		const mockSqlFiles: any[] = [
			{
				path: '/test/foo.sql',
				content: 'CREATE TABLE foo (a INT);',
				dependencies: [
					{
						tableName: 'foo',
						dependsOn: [] as string[],
					},
				],
			},
			{
				path: '/test/bar.sql',
				content: 'CREATE TABLE bar (b INT, FOREIGN KEY (b) REFERENCES foo(a));',
				dependencies: [
					{
						tableName: 'bar',
						dependsOn: ['foo'] as string[],
					},
				],
			},
		];

		it('should analyze dependencies successfully', async () => {
			const options: InfoOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			await infoCommand('/test/input', options);

			expect(mockSqlMergerInstance.analyzeDependencies).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
			);
		});

		it('should handle quiet mode in info command', async () => {
			const options: InfoOptions = {
				dialect: 'postgresql',
				quiet: true,
			};

			await infoCommand('/test/input', options);

			expect(mockSqlMergerInstance.analyzeDependencies).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
			);
		});

		it('should handle circular dependency errors', async () => {
			const options: InfoOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			const circularError = new Error(
				'Circular dependencies detected between tables: foo, bar',
			);
			mockSqlMergerInstance.analyzeDependencies.mockImplementation(() => {
				throw circularError;
			});

			await expect(infoCommand('/test/input', options)).rejects.toThrow(
				'Circular dependencies detected',
			);
		});
	});

	describe('Validate Command', () => {
		const mockValidFiles: any[] = [
			{
				path: '/test/foo.sql',
				content: 'CREATE TABLE foo (a INT);',
				dependencies: [
					{
						tableName: 'foo',
						dependsOn: [] as string[],
					},
				],
			},
			{
				path: '/test/bar.sql',
				content: 'CREATE TABLE bar (b INT, FOREIGN KEY (b) REFERENCES foo(a));',
				dependencies: [
					{
						tableName: 'bar',
						dependsOn: ['foo'] as string[],
					},
				],
			},
		];

		it('should validate files successfully', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			await validateCommand('/test/input', options);

			expect(mockSqlMergerInstance.validateFiles).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
			);
		});

		it('should handle syntax errors in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			mockSqlMergerInstance.validateFiles.mockImplementation(() => {
				throw new Error('Syntax error in SQL');
			});

			await expect(validateCommand('/test/input', options)).rejects.toThrow(
				'Syntax error in SQL',
			);
		});

		it('should detect circular dependencies in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			mockSqlMergerInstance.validateFiles.mockImplementation(() => {
				throw new Error('Circular dependencies detected');
			});

			await expect(validateCommand('/test/input', options)).rejects.toThrow(
				'Circular dependencies detected',
			);
		});

		it('should handle empty directory in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			await validateCommand('/test/input', options);

			expect(mockSqlMergerInstance.validateFiles).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
			);
		});

		it('should handle quiet mode in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: true,
			};

			await validateCommand('/test/input', options);

			expect(mockSqlMergerInstance.validateFiles).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle SqlMerger errors in merge command', async () => {
			const options: CliOptions = {
				dialect: 'postgresql',
				comments: true,
				header: true,
				separate: true,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false,
			};

			mockSqlMergerInstance.parseSqlFile.mockImplementation(() => {
				throw new Error('Failed to parse SQL files');
			});

			await expect(mergeCommand('/test/input', options)).rejects.toThrow(
				'Failed to parse SQL files',
			);
		});

		it('should handle file system errors', async () => {
			(fs.existsSync as any).mockImplementation(() => {
				throw new Error('File system error');
			});

			expect(() => validateInputDirectory('/test/path')).toThrow(
				'File system error',
			);
		});
	});
});

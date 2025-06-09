import * as fs from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type CliOptions,
	createProgram,
	type InfoOptions,
	infoCommand,
	mergeCommand,
	type ValidateOptions,
	validateCommand,
	validateInputDirectory,
} from '../src/cli.js';
import { type SqlFile, SqlMerger } from '../src/sql-merger.js';

// Mock the SqlMerger class
vi.mock('../src/sql-merger.js', () => {
	const MockSqlMerger = vi.fn(() => ({
		parseSqlFile: vi.fn(),
		topologicalSort: vi.fn(),
		mergeFiles: vi.fn(),
		findSqlFiles: vi.fn(),
		parseSingleFile: vi.fn(),
		buildDependencyGraph: vi.fn(),
		detectCycles: vi.fn().mockReturnValue([]), // Default to no cycles
		visualizeDependencyGraph: vi.fn(),
	}));

	return {
		SqlMerger: MockSqlMerger,
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
	readFileSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

// Mock console methods to capture output
let mockConsoleLog: any;
let mockConsoleError: any;
let mockProcessExit: any;

describe('CLI Interface', () => {
	let mockSqlMergerInstance: any;

	beforeEach(() => {
		// Setup console spies before other mocks
		mockConsoleLog = vi.spyOn(console, 'log');
		mockConsoleError = vi.spyOn(console, 'error');
		mockProcessExit = vi
			.spyOn(process, 'exit')
			.mockImplementation((code?: number | string | null | undefined) => {
				throw new Error(`process.exit unexpectedly called with "${code}"`);
			});

		// Setup SqlMerger mock instance
		mockSqlMergerInstance = {
			parseSqlFile: vi.fn(),
			topologicalSort: vi.fn(),
			mergeFiles: vi.fn(),
			findSqlFiles: vi.fn(),
			parseSingleFile: vi.fn(),
			buildDependencyGraph: vi.fn(),
			detectCycles: vi.fn().mockReturnValue([]), // Default to no cycles
			visualizeDependencyGraph: vi.fn(),
		};

		(SqlMerger as any).mockImplementation(() => mockSqlMergerInstance);

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

			expect(program.name()).toBe('sql-merger');
			expect(program.description()).toBe(
				'A tool for merging SQL files with dependency resolution',
			);
			expect(program.version()).toBe('1.0.0');
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
		const mockSqlFiles: SqlFile[] = [
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
				allowReorderDropComments: false
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.mergeFiles.mockReturnValue('merged SQL content');

			await mergeCommand('/test/input', options);

			expect(mockSqlMergerInstance.parseSqlFile).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
				{
					allowReorderDropComments: false,
				},
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
			expect(mockConsoleLog).toHaveBeenCalledWith('🔧 SQL Merger v1.0.0');
		});

		it('should handle quiet mode correctly', async () => {
			const options: CliOptions = {
				dialect: 'postgresql',
				comments: true,
				header: true,
				separate: true,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.mergeFiles.mockReturnValue('merged SQL content');

			await mergeCommand('/test/input', options);

			// Should not log the header in quiet mode
			expect(mockConsoleLog).not.toHaveBeenCalledWith('🔧 SQL Merger v1.0.0');
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
				allowReorderDropComments: false
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.mergeFiles.mockReturnValue('merged SQL content');

			await mergeCommand('/test/input', options);

			expect(fs.existsSync).toHaveBeenCalledWith(resolve('/valid'));
			expect(mockSqlMergerInstance.mergeFiles).toHaveBeenCalledWith(
				mockSqlFiles,
				expect.objectContaining({
					outputPath: '/valid/output.sql'
				})
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
				allowReorderDropComments: false
			};

			// Mock output directory as non-existent
			(fs.existsSync as any).mockImplementation((path: string) => {
				return !path.includes('/invalid/dir');
			});

			await expect(mergeCommand('/test/input', options)).rejects.toThrow('Output directory does not exist');
		});

		it('should reject invalid SQL dialect', async () => {
			const options: CliOptions = {
				dialect: 'invalid-dialect',
				comments: true,
				header: true,
				separate: true,
				quiet: true,
				verbose: false,
				allowReorderDropComments: false
			};

			await expect(mergeCommand('/test/input', options)).rejects.toThrow(
				'Invalid dialect: invalid-dialect. Must be one of: postgresql, mysql, sqlite, bigquery'
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
				allowReorderDropComments: false
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
		const mockSqlFiles: SqlFile[] = [
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

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.topologicalSort.mockReturnValue(mockSqlFiles);

			await infoCommand('/test/input', options);

			expect(mockSqlMergerInstance.parseSqlFile).toHaveBeenCalledWith(
				resolve('/test/input'),
				'postgresql',
			);
			expect(mockSqlMergerInstance.topologicalSort).toHaveBeenCalledWith(
				mockSqlFiles,
			);
			expect(mockConsoleLog).toHaveBeenCalledWith('🔍 SQL Dependency Analyzer');
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'\n📋 Recommended execution order:',
			);
		});

		it('should handle quiet mode in info command', async () => {
			const options: InfoOptions = {
				dialect: 'postgresql',
				quiet: true,
			};

			mockSqlMergerInstance.parseSqlFile.mockReturnValue(mockSqlFiles);
			mockSqlMergerInstance.topologicalSort.mockReturnValue(mockSqlFiles);

			await infoCommand('/test/input', options);

			expect(mockConsoleLog).not.toHaveBeenCalledWith(
				'🔍 SQL Dependency Analyzer',
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'\n📋 Recommended execution order:',
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
			mockSqlMergerInstance.parseSqlFile.mockImplementation(() => {
				throw circularError;
			});

			// Mock fallback visualization attempt
			mockSqlMergerInstance.findSqlFiles.mockReturnValue([
				'/test/foo.sql',
				'/test/bar.sql',
			]);
			mockSqlMergerInstance.parseSingleFile.mockReturnValue(mockSqlFiles[0]);
			mockSqlMergerInstance.buildDependencyGraph.mockReturnValue({});
			mockSqlMergerInstance.detectCycles.mockReturnValue([
				['foo', 'bar', 'foo'],
			]);
			mockSqlMergerInstance.visualizeDependencyGraph.mockReturnValue(undefined);

			await expect(infoCommand('/test/input', options)).rejects.toThrow(
				'Circular dependencies detected',
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'❌ Circular dependencies detected - cannot determine safe execution order',
			);
		});
	});

	describe('Validate Command', () => {
		const mockValidFiles: SqlFile[] = [
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

			mockSqlMergerInstance.findSqlFiles.mockReturnValue([
				'/test/foo.sql',
				'/test/bar.sql',
			]);
			mockSqlMergerInstance.parseSingleFile.mockReturnValue(mockValidFiles[0]);
			mockSqlMergerInstance.buildDependencyGraph.mockReturnValue({});
			mockSqlMergerInstance.detectCycles.mockReturnValue([]);

			await validateCommand('/test/input', options);

			expect(mockSqlMergerInstance.findSqlFiles).toHaveBeenCalledWith(
				resolve('/test/input'),
			);
			expect(mockSqlMergerInstance.parseSingleFile).toHaveBeenCalledTimes(2);
			expect(mockConsoleLog).toHaveBeenCalledWith('✅ SQL Validator');
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'\n✅ All 2 SQL files are valid',
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'✅ No circular dependencies detected',
			);
			expect(mockConsoleLog).toHaveBeenCalledWith('✅ Ready for merging');
		});

		it('should handle syntax errors in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			mockSqlMergerInstance.findSqlFiles.mockReturnValue(['/test/invalid.sql']);
			mockSqlMergerInstance.parseSingleFile.mockImplementation(() => {
				throw new Error('Syntax error in SQL');
			});

			try {
				await validateCommand('/test/input', options);
			} catch (error: any) {
				expect(error.message).toContain(
					'process.exit unexpectedly called with "1"',
				);
			}

			expect(mockConsoleError).toHaveBeenCalledWith(
				'❌ invalid.sql: Syntax error in SQL',
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'\n❌ Validation failed: 1 files have syntax errors',
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it('should detect circular dependencies in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			mockSqlMergerInstance.findSqlFiles.mockReturnValue([
				'/test/foo.sql',
				'/test/bar.sql',
			]);
			mockSqlMergerInstance.parseSingleFile.mockReturnValue(mockValidFiles[0]);
			mockSqlMergerInstance.buildDependencyGraph.mockReturnValue({});
			mockSqlMergerInstance.detectCycles.mockReturnValue([
				['foo', 'bar', 'foo'],
			]);

			try {
				await validateCommand('/test/input', options);
			} catch (error: any) {
				expect(error.message).toContain(
					'process.exit unexpectedly called with "1"',
				);
			}

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'\n❌ Circular dependencies detected:',
			);
			expect(mockConsoleLog).toHaveBeenCalledWith('  1. foo → bar → foo');
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it('should handle empty directory in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: false,
			};

			mockSqlMergerInstance.findSqlFiles.mockReturnValue([]);

			await validateCommand('/test/input', options);

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'📁 Found 0 SQL files to validate',
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'\n✅ All 0 SQL files are valid',
			);
		});

		it('should handle quiet mode in validation', async () => {
			const options: ValidateOptions = {
				dialect: 'postgresql',
				quiet: true,
			};

			mockSqlMergerInstance.findSqlFiles.mockReturnValue(['/test/foo.sql']);
			mockSqlMergerInstance.parseSingleFile.mockReturnValue(mockValidFiles[0]);
			mockSqlMergerInstance.buildDependencyGraph.mockReturnValue({});
			mockSqlMergerInstance.detectCycles.mockReturnValue([]);

			await validateCommand('/test/input', options);

			expect(mockConsoleLog).not.toHaveBeenCalledWith('✅ SQL Validator');
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'\n✅ All 1 SQL files are valid',
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
				allowReorderDropComments: false
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

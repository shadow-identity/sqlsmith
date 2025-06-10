import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemValidator } from '../src/services/file-system-validator.js';

// Mock fs module
vi.mock('fs', () => ({
	existsSync: vi.fn(),
	statSync: vi.fn(),
	readdirSync: vi.fn(),
}));

describe('FileSystemValidator', () => {
	let validator: FileSystemValidator;

	beforeEach(() => {
		validator = new FileSystemValidator();

		// Mock fs by default to simulate valid paths
		(fs.existsSync as any).mockReturnValue(true);
		(fs.statSync as any).mockReturnValue({ isDirectory: () => true });
		// Mock readdirSync to simulate a directory with SQL files
		(fs.readdirSync as any).mockReturnValue([
			{ name: 'test.sql', isFile: () => true },
		]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('validateInputDirectory', () => {
		it('should validate existing directory successfully', () => {
			expect(() => validator.validateInputDirectory('/valid/path')).not.toThrow();
			expect(fs.existsSync).toHaveBeenCalledWith('/valid/path');
			expect(fs.statSync).toHaveBeenCalledWith('/valid/path');
		});

		it('should throw error for non-existent directory', () => {
			(fs.existsSync as any).mockReturnValue(false);

			expect(() => validator.validateInputDirectory('/invalid/path')).toThrow(
				'Input directory does not exist: /invalid/path',
			);
		});

		it('should throw error for non-directory path', () => {
			(fs.statSync as any).mockReturnValue({ isDirectory: () => false });

			expect(() => validator.validateInputDirectory('/file/path')).toThrow(
				'Input path is not a directory: /file/path',
			);
		});

		it('should throw error for unreadable directory', () => {
			// Setup: Mock readdirSync to throw when trying to read the directory
			(fs.readdirSync as any).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			expect(() => validator.validateInputDirectory('/unreadable/path')).toThrow(
				'Cannot read input directory: Permission denied',
			);
		});

		it('should throw error for directories with no SQL files', () => {
			// Setup: Mock readdirSync to return no SQL files (e.g., only txt files)
			(fs.readdirSync as any).mockReturnValue([
				{ name: 'readme.txt', isFile: () => true },
				{ name: 'config.json', isFile: () => true },
			]);

			expect(() => validator.validateInputDirectory('/empty/path')).toThrow(
				'No SQL files found in directory: /empty/path',
			);
		});

		it('should handle other readdirSync errors as validation failures', () => {
			// Setup: Mock readdirSync to succeed on first call but fail on second call with withFileTypes
			let callCount = 0;
			(fs.readdirSync as any).mockImplementation((path: string, options?: any) => {
				callCount++;
				if (callCount === 1) {
					// First call (permission check) - succeed
					return ['file1.sql', 'file2.txt'];
				} else {
					// Second call with withFileTypes - throw error
					throw new Error('Filesystem error during file listing');
				}
			});

			expect(() => validator.validateInputDirectory('/invalid/fs/path')).toThrow(
				'Cannot read input directory: Filesystem error during file listing',
			);
		});
	});

	describe('validateOutputDirectory', () => {
		it.skip('should validate existing output directory', () => {
			// TODO: Implement test for validateOutputDirectory with existing directory
		});

		it.skip('should throw error for non-existent output directory', () => {
			// TODO: Implement test for validateOutputDirectory with non-existent directory
		});

		it.skip('should handle output file path correctly', () => {
			// TODO: Implement test for validateOutputDirectory extracting directory path
		});
	});

	describe('validateDialect', () => {
		it.skip('should validate supported SQL dialects', () => {
			// TODO: Implement test for validateDialect with valid dialects
		});

		it.skip('should throw error for unsupported dialect', () => {
			// TODO: Implement test for validateDialect with invalid dialect
		});

		it.skip('should be case sensitive for dialect validation', () => {
			// TODO: Implement test for validateDialect case sensitivity
		});
	});
}); 
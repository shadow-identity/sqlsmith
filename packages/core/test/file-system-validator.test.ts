import * as fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemValidator } from '../src/services/file-system-validator.js';
import { SUPPORTED_DIALECTS } from '../src/types/dialect.js';
import {
	type ConfigurationError,
	ErrorCode,
	FileSystemError,
} from '../src/types/errors.js';

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readdirSync: vi.fn(),
	statSync: vi.fn(),
}));

// C3-TYPED-FS / R3-01 / R3-02
describe('FileSystemValidator typed contracts', () => {
	let validator: FileSystemValidator;

	beforeEach(() => {
		validator = new FileSystemValidator();
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.statSync).mockReturnValue({
			isDirectory: () => true,
		} as fs.Stats);
		vi.mocked(fs.readdirSync).mockReturnValue([
			{ name: 'test.sql', isFile: () => true },
		] as fs.Dirent[]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('validates an existing readable directory with one listing', () => {
		expect(() => validator.validateInputDirectory('/valid/path')).not.toThrow();
		expect(fs.readdirSync).toHaveBeenCalledTimes(1);
	});

	it('reports a missing directory', () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);

		expect(() => validator.validateInputDirectory('/missing')).toThrowError(
			expect.objectContaining({
				code: ErrorCode.DIRECTORY_NOT_FOUND,
				context: { path: '/missing' },
			}) as FileSystemError,
		);
	});

	it('reports a non-directory input', () => {
		vi.mocked(fs.statSync).mockReturnValue({
			isDirectory: () => false,
		} as fs.Stats);

		expect(() => validator.validateInputDirectory('/file.sql')).toThrowError(
			expect.objectContaining({
				code: ErrorCode.NOT_A_DIRECTORY,
				context: { path: '/file.sql' },
			}) as FileSystemError,
		);
	});

	it('preserves an unreadable-directory cause', () => {
		const originalError = new Error('permission sentinel');
		vi.mocked(fs.readdirSync).mockImplementation(() => {
			throw originalError;
		});

		try {
			validator.validateInputDirectory('/unreadable');
			expect.fail('expected unreadable directory error');
		} catch (error) {
			expect(error).toBeInstanceOf(FileSystemError);
			expect(error).toMatchObject({
				code: ErrorCode.DIRECTORY_NOT_READABLE,
				context: { path: '/unreadable', operation: 'readDirectory' },
				originalError,
			});
		}
	});

	it('reports a readable directory without SQL files', () => {
		vi.mocked(fs.readdirSync).mockReturnValue([
			{ name: 'README.md', isFile: () => true },
		] as fs.Dirent[]);

		expect(() => validator.validateInputDirectory('/empty')).toThrowError(
			expect.objectContaining({
				code: ErrorCode.NO_SQL_FILES,
				context: { directory: '/empty' },
			}) as FileSystemError,
		);
	});

	it('accepts an output path whose parent is a directory', () => {
		expect(() =>
			validator.validateOutputDirectory('/out/schema.sql'),
		).not.toThrow();
	});

	it('reports a missing output parent', () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);

		expect(() =>
			validator.validateOutputDirectory('/missing/schema.sql'),
		).toThrowError(
			expect.objectContaining({
				code: ErrorCode.INVALID_OUTPUT_PATH,
				context: { path: '/missing/schema.sql' },
			}) as FileSystemError,
		);
	});

	it('reports an output parent that is not a directory', () => {
		vi.mocked(fs.statSync).mockReturnValue({
			isDirectory: () => false,
		} as fs.Stats);

		expect(() =>
			validator.validateOutputDirectory('/file/schema.sql'),
		).toThrowError(
			expect.objectContaining({
				code: ErrorCode.INVALID_OUTPUT_PATH,
			}) as FileSystemError,
		);
	});

	it.each(SUPPORTED_DIALECTS)('accepts supported dialect %s', (dialect) => {
		expect(() => validator.validateDialect(dialect)).not.toThrow();
	});

	it('reports unsupported dialects as configuration errors', () => {
		expect(() => validator.validateDialect('oracle')).toThrowError(
			expect.objectContaining({
				code: ErrorCode.INVALID_OPTIONS,
				context: { optionName: 'dialect', value: 'oracle' },
			}) as ConfigurationError,
		);
	});
});

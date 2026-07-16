import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	ConfigurationError,
	ErrorCode,
	FileSystemValidator,
	type LogLevel,
} from '@sqlsmith/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getVersion, prepareContext, validateLogLevel } from './utils';

vi.mock('node:fs');
vi.mock('node:path');
vi.mock('@sqlsmith/core', async () => {
	const original =
		await vi.importActual<typeof import('@sqlsmith/core')>('@sqlsmith/core');
	return {
		...original,
		FileSystemValidator: vi.fn(),
	};
});

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedResolve = vi.mocked(resolve);
const mockedFileSystemValidator = vi.mocked(FileSystemValidator);

describe('validateLogLevel', () => {
	it.each(['error', 'warn', 'info', 'debug'])(
		'should return valid log level "%s"',
		(logLevel) => {
			expect(validateLogLevel(logLevel)).toBe(logLevel);
		},
	);

	it('should throw an error for an invalid log level', () => {
		try {
			validateLogLevel('invalid');
			expect.unreachable('validateLogLevel should reject an invalid value');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigurationError);
			expect(error).toMatchObject({
				code: ErrorCode.INVALID_OPTIONS,
				context: { optionName: 'logLevel', value: 'invalid' },
			});
		}
	});
});

// The exit-code contract of handleCommandError is covered by
// utils.exit-codes.test.ts against the real implementation.

describe('prepareContext', () => {
	const mockValidateInputDirectory = vi.fn();
	const mockValidateOutputDirectory = vi.fn();
	const mockValidateDialect = vi.fn();

	beforeEach(() => {
		mockValidateInputDirectory.mockClear();
		mockValidateOutputDirectory.mockClear();
		mockValidateDialect.mockClear();
		mockedFileSystemValidator.mockImplementation(
			class {
				validateInputDirectory = mockValidateInputDirectory;
				validateOutputDirectory = mockValidateOutputDirectory;
				validateDialect = mockValidateDialect;
			} as any,
		);
		mockedResolve.mockImplementation((...paths) => paths.join('/'));
	});

	it('should prepare context with input and output paths', () => {
		const options = {
			output: 'some/output',
			dialect: 'postgresql',
			logLevel: 'debug' as LogLevel,
		};
		const result = prepareContext('some/input', options);

		expect(mockedResolve).toHaveBeenCalledWith('some/input');
		expect(mockedResolve).toHaveBeenCalledWith('some/output');
		expect(mockValidateInputDirectory).toHaveBeenCalledWith('some/input');
		expect(mockValidateOutputDirectory).toHaveBeenCalledWith('some/output');
		expect(mockValidateDialect).toHaveBeenCalledWith('postgresql');
		expect(result).toEqual({
			resolvedInput: 'some/input',
			resolvedOutput: 'some/output',
			logLevel: 'debug',
		});
	});

	it('should prepare context without output path', () => {
		const options = {
			dialect: 'sqlite',
			logLevel: 'info' as LogLevel,
		};
		const result = prepareContext('another/input', options);

		expect(mockedResolve).toHaveBeenCalledWith('another/input');
		expect(mockValidateInputDirectory).toHaveBeenCalledWith('another/input');
		expect(mockValidateOutputDirectory).not.toHaveBeenCalled();
		expect(mockValidateDialect).toHaveBeenCalledWith('sqlite');
		expect(result).toEqual({
			resolvedInput: 'another/input',
			resolvedOutput: undefined,
			logLevel: 'info',
		});
	});

	it('should throw on invalid log level', () => {
		const options = {
			dialect: 'sqlite',
			logLevel: 'invalid' as LogLevel,
		};
		expect(() => prepareContext('another/input', options)).toThrow(
			ConfigurationError,
		);
	});
});

describe('getVersion', () => {
	beforeEach(() => {
		mockedResolve.mockReturnValue('/fake/path/to/package.json');
	});

	afterEach(() => {
		vi.mocked(readFileSync).mockReset();
	});

	it('should return the version from package.json', () => {
		const packageJsonContent = JSON.stringify({ version: '1.2.3' });
		mockedReadFileSync.mockReturnValue(packageJsonContent);

		const version = getVersion();

		expect(version).toBe('1.2.3');
		expect(mockedResolve).toHaveBeenCalledWith(__dirname, '../package.json');
		expect(mockedReadFileSync).toHaveBeenCalledWith(
			'/fake/path/to/package.json',
			'utf-8',
		);
	});

	it('should throw an error if version is not found', () => {
		const packageJsonContent = JSON.stringify({ name: 'my-package' });
		mockedReadFileSync.mockReturnValue(packageJsonContent);

		expect(() => getVersion()).toThrow(
			'No valid version found in package.json',
		);
	});

	it('should throw an error if version is not a string', () => {
		const packageJsonContent = JSON.stringify({ version: 123 });
		mockedReadFileSync.mockReturnValue(packageJsonContent);

		expect(() => getVersion()).toThrow(
			'No valid version found in package.json',
		);
	});

	it('should throw an error if readFileSync fails', () => {
		mockedReadFileSync.mockImplementation(() => {
			throw new Error('File not found');
		});

		expect(() => getVersion()).toThrow(
			'Failed to read version from package.json: File not found',
		);
	});

	it('should throw an error for invalid JSON', () => {
		mockedReadFileSync.mockReturnValue('invalid json');

		expect(() => getVersion()).toThrow(
			/Failed to read version from package.json: Unexpected token/,
		);
	});
});

import {
	ConfigurationError,
	DependencyError,
	FileSystemError,
} from '@sqlsmith/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCommandError } from './utils.js';

/**
 * Exit-code contract of the CLI error handler:
 *   2 — input/file errors, 3 — dependency errors, 4 — configuration errors,
 *   1 — anything else.
 */
describe('handleCommandError exit codes', () => {
	let exitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('process.exit called');
		}) as never);
		vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'info').mockImplementation(() => {});
		vi.spyOn(console, 'debug').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const expectExitCode = (error: unknown, expectedCode: number): void => {
		expect(() => handleCommandError(error, 'error')).toThrow(
			'process.exit called',
		);
		expect(exitSpy).toHaveBeenCalledWith(expectedCode);
	};

	it('exits with 2 for file system errors', () => {
		expectExitCode(FileSystemError.noSqlFiles('/some/dir'), 2);
	});

	it('exits with 2 for missing directories', () => {
		expectExitCode(FileSystemError.directoryNotFound('/some/dir'), 2);
	});

	it('exits with 3 for circular dependencies', () => {
		expectExitCode(DependencyError.circularDependency([['a', 'b', 'a']]), 3);
	});

	it('exits with 3 for duplicate statement names', () => {
		expectExitCode(
			DependencyError.duplicateStatementNames([
				{ name: 'users', files: ['a.sql', 'b.sql'] },
			]),
			3,
		);
	});

	it('exits with 4 for configuration errors', () => {
		expectExitCode(ConfigurationError.invalidOptions('dialect', 'nope'), 4);
	});

	it('exits with 1 for unknown errors', () => {
		expectExitCode(new Error('something unexpected'), 1);
	});
});

import {
	ConfigurationError,
	DependencyError,
	ErrorCode,
	FileSystemError,
	ParsingError,
	ProcessingError,
	type SqlMergerError,
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

	// C3-EXIT-MATRIX / R3-03
	it.each<[string, SqlMergerError, number]>([
		['missing directory', FileSystemError.directoryNotFound('/dir'), 2],
		['missing file', FileSystemError.fileNotFound('/file.sql'), 2],
		['no SQL files', FileSystemError.noSqlFiles('/dir'), 2],
		['invalid output', FileSystemError.invalidOutputPath('/out.sql'), 2],
		[
			'circular dependency',
			DependencyError.circularDependency([['a', 'b', 'a']]),
			3,
		],
		[
			'duplicate relation',
			DependencyError.duplicateStatementNames([
				{ name: 'users', files: ['a.sql', 'b.sql'] },
			]),
			3,
		],
		['missing dependency', DependencyError.missingDependency('a', 'b'), 3],
		[
			'invalid source order',
			DependencyError.invalidStatementOrder('a.sql', 'b appears later'),
			3,
		],
		[
			'invalid configuration',
			ConfigurationError.invalidOptions('dialect', 'oracle'),
			4,
		],
		[
			'missing configuration',
			ConfigurationError.missingRequiredOption('input'),
			4,
		],
		[
			'invalid SQL',
			ParsingError.invalidSqlSyntax('/bad.sql', 2, new Error('syntax')),
			1,
		],
		['parser failure', ParsingError.parsingFailed('/bad.sql'), 1],
		['processor failure', ProcessingError.processorError('Fake'), 1],
		['merge failure', ProcessingError.mergeFailed('sentinel'), 1],
	])('maps %s', (_name, error, expectedCode) => {
		expectExitCode(error, expectedCode);
	});

	it('maps the legacy unsupported-dialect code to configuration exit 4', () => {
		const error = ParsingError.unsupportedDialect('oracle');
		expect(error.code).toBe(ErrorCode.UNSUPPORTED_DIALECT);
		expectExitCode(error, 4);
	});

	it('exits with 1 for unknown errors', () => {
		expectExitCode(new Error('something unexpected'), 1);
	});
});

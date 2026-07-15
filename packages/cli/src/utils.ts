import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ErrorCode,
	FileSystemValidator,
	Logger,
	type LogLevel,
	SqlMergerError,
} from '@sqlsmith/core';

/**
 * Validate log level option
 */
export const validateLogLevel = (value: string): LogLevel => {
	const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
	if (!validLevels.includes(value as LogLevel)) {
		throw new Error(
			`Invalid log level: ${value}. Must be one of: ${validLevels.join(', ')}`,
		);
	}
	return value as LogLevel;
};

/**
 * Handle command errors and terminate the process with an exit code that
 * reflects the error category: 2 — input/file errors, 3 — dependency errors,
 * 4 — configuration errors, 1 — anything else.
 */
export const handleCommandError = (
	error: unknown,
	logLevel: LogLevel,
): never => {
	// SqlMergerError instances are already logged by the core error handler.
	if (!(error instanceof SqlMergerError)) {
		const logger = new Logger({ logLevel });
		logger.error(error instanceof Error ? error.message : String(error));
	}

	let exitCode = 1;
	if (error instanceof SqlMergerError) {
		switch (error.code) {
			case ErrorCode.DIRECTORY_NOT_FOUND:
			case ErrorCode.FILE_NOT_FOUND:
			case ErrorCode.NO_SQL_FILES:
				exitCode = 2;
				break;
			case ErrorCode.CIRCULAR_DEPENDENCY:
			case ErrorCode.DUPLICATE_STATEMENT_NAMES:
				exitCode = 3;
				break;
			case ErrorCode.INVALID_OPTIONS:
			case ErrorCode.MISSING_REQUIRED_OPTION:
				exitCode = 4;
				break;
			default:
				exitCode = 1;
		}
	}

	process.exit(exitCode);
};

/**
 * Prepare common context for CLI commands: resolve paths, validate them and the dialect,
 * and return the effective (validated) log level together with resolved paths.
 */
export const prepareContext = <
	T extends { output?: string; dialect: string; logLevel: LogLevel },
>(
	input: string,
	options: T,
) => {
	// Validate log level first – we need it for consistent error handling
	const logLevel = validateLogLevel(options.logLevel);

	const validator = new FileSystemValidator();

	// Resolve and validate input directory
	const resolvedInput = resolve(input);
	validator.validateInputDirectory(resolvedInput);

	// Resolve and validate output path when provided
	let resolvedOutput: string | undefined;
	if (options.output) {
		resolvedOutput = resolve(options.output);
		validator.validateOutputDirectory(resolvedOutput);
	}

	// Validate dialect
	validator.validateDialect(options.dialect);

	return { resolvedInput, resolvedOutput, logLevel } as const;
};

// Read version from package.json
export const getVersion = (): string => {
	const moduleDirname =
		typeof __dirname !== 'undefined'
			? __dirname
			: dirname(fileURLToPath(import.meta.url));
	const packageJsonPath = resolve(moduleDirname, '../package.json');

	try {
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

		if (!packageJson?.version || typeof packageJson.version !== 'string') {
			throw new Error('No valid version found in package.json');
		}

		return packageJson.version;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to read version from package.json: ${message}`);
	}
};

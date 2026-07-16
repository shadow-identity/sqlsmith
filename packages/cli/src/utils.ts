import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ConfigurationError,
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
	const validLevels: LogLevel[] = ['silent', 'error', 'warn', 'info', 'debug'];
	if (!validLevels.includes(value as LogLevel)) {
		throw ConfigurationError.invalidOptions('logLevel', value);
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
	const logger = new Logger({ logLevel });
	logger.error(
		error instanceof SqlMergerError
			? error.getDetailedMessage()
			: error instanceof Error
				? error.message
				: String(error),
	);

	let exitCode = 1;
	if (error instanceof SqlMergerError) {
		switch (error.code) {
			case ErrorCode.DIRECTORY_NOT_FOUND:
			case ErrorCode.NOT_A_DIRECTORY:
			case ErrorCode.DIRECTORY_NOT_READABLE:
			case ErrorCode.FILE_NOT_FOUND:
			case ErrorCode.FILE_READ_FAILED:
			case ErrorCode.FILE_WRITE_FAILED:
			case ErrorCode.NO_SQL_FILES:
			case ErrorCode.INVALID_OUTPUT_PATH:
				exitCode = 2;
				break;
			case ErrorCode.CIRCULAR_DEPENDENCY:
			case ErrorCode.DUPLICATE_STATEMENT_NAMES:
			case ErrorCode.MISSING_DEPENDENCY:
			case ErrorCode.INVALID_STATEMENT_ORDER:
				exitCode = 3;
				break;
			case ErrorCode.INVALID_OPTIONS:
			case ErrorCode.MISSING_REQUIRED_OPTION:
			case ErrorCode.UNSUPPORTED_DIALECT:
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

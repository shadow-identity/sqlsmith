import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	ErrorHandler,
	FileSystemValidator,
	Logger,
	type LogLevel,
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
 * Handle command errors with consistent formatting
 */
export const handleCommandError = (
	error: unknown,
	logLevel: LogLevel,
): void => {
	const logger = new Logger({ logLevel });
	const errorHandler = new ErrorHandler(logger);
	errorHandler.handleCommandError(error);
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
	const packageJsonPath = resolve(__dirname, '../package.json');

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

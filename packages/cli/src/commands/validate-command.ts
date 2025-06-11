import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';

export type ValidateCommandOptions = {
	dialect: SqlDialect;
	logLevel: LogLevel;
};

/**
 * Validate command implementation - check syntax and dependencies
 */
export const executeValidateCommand = async (
	inputPath: string,
	options: ValidateCommandOptions,
): Promise<void> => {
	const container = new ServiceContainer({
		loggerOptions: {
			logLevel: options.logLevel,
		},
	});

	const logger = container.getLogger();

	// Resolve input path (already validated by CLI layer)
	const resolvedInput = resolve(inputPath);

	// Create merger with container
	const merger = SqlMerger.withContainer(container);

	try {
		await merger.validateFiles(resolvedInput, options.dialect);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Validation failed: ${errorMessage}`);
		throw error;
	}
};

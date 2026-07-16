import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';

export type ValidateCommandOptions = {
	dialect: SqlDialect;
	logLevel: LogLevel;
	allowExternalReferences?: boolean;
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
		allowExternalReferences: options.allowExternalReferences ?? false,
	});

	// Resolve input path (already validated by CLI layer)
	const resolvedInput = resolve(inputPath);

	// Create merger with container
	const merger = SqlMerger.withContainer(container);

	await merger.validateFiles(resolvedInput, options.dialect);
};

import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';

export type InfoCommandOptions = {
	dialect: SqlDialect;
	logLevel: LogLevel;
};

/**
 * Info command implementation - analyze dependencies
 */
export const executeInfoCommand = async (
	inputPath: string,
	options: InfoCommandOptions,
): Promise<void> => {
	const container = new ServiceContainer({
		loggerOptions: {
			logLevel: options.logLevel,
		},
	});

	// Resolve input path (already validated by CLI layer)
	const resolvedInput = resolve(inputPath);

	// Create merger with container
	const merger = SqlMerger.withContainer(container);

	merger.analyzeDependencies(resolvedInput, options.dialect as SqlDialect);
};

import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';

export type MergeCommandOptions = {
	output?: string;
	dialect: SqlDialect;
	logLevel: LogLevel;
	allowReorderDropComments?: boolean;
};

/**
 * Merge command implementation
 */
export const executeMergeCommand = async (
	inputPath: string,
	options: MergeCommandOptions,
): Promise<void> => {
	const container = new ServiceContainer({
		loggerOptions: {
			logLevel: options.logLevel,
		},
		allowReorderDropComments: options.allowReorderDropComments ?? false,
	});

	const logger = container.getLogger();

	logger.info(`🔧 SQL Merger`);

	const resolvedInput = resolve(inputPath);

	const merger = SqlMerger.withContainer(container);

	const sqlFiles = merger.parseSqlFiles(resolvedInput, options.dialect);

	merger.mergeFiles(sqlFiles, {
		addComments: true,
		includeHeader: true,
		separateStatements: true,
		outputPath: options.output,
	});

	logger.success('Merge completed successfully');
};

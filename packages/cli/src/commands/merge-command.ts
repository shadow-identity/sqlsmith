import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';

export type MergeCommandOptions = {
	output?: string;
	dialect: SqlDialect;
	logLevel: LogLevel;
	validateSourceOrder?: boolean;
	allowExternalReferences?: boolean;
};

/**
 * Merge command implementation. The core merger computes the merged SQL;
 * this command delivers it — to the output file or to stdout.
 */
export const executeMergeCommand = async (
	inputPath: string,
	options: MergeCommandOptions,
): Promise<void> => {
	const container = new ServiceContainer({
		loggerOptions: {
			logLevel: options.logLevel,
		},
		validateSourceOrder: options.validateSourceOrder ?? true,
		allowExternalReferences: options.allowExternalReferences ?? false,
	});

	const logger = container.getLogger();

	logger.info(`🔧 SQL Merger`);

	const resolvedInput = resolve(inputPath);

	const merger = SqlMerger.withContainer(container);

	const sqlFiles = merger.parseSqlFiles(resolvedInput, options.dialect);

	const merged = merger.mergeFiles(sqlFiles, {
		addComments: true,
		includeHeader: true,
		separateStatements: true,
	});

	if (options.output) {
		try {
			writeFileSync(options.output, merged, 'utf-8');
			logger.info(`💾 Output written to: ${options.output}`);
		} catch (error) {
			throw new Error(
				`Failed to write output file ${options.output}: ${error}`,
			);
		}
	} else {
		process.stdout.write(merged.endsWith('\n') ? merged : `${merged}\n`);
	}

	logger.success('Merge completed successfully');
};

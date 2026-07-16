import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LogLevel } from '@sqlsmith/core';
import {
	FileSystemError,
	Logger,
	type SqlDialect,
	SqlMerger,
} from '@sqlsmith/core';
import { renderDiagnostics } from './renderers.js';

export type MergeCommandOptions = {
	output?: string;
	dialect: SqlDialect;
	logLevel: LogLevel;
	validateSourceOrder?: boolean;
	allowExternalReferences?: boolean;
	defaultSchema?: string;
};

export const executeMergeCommand = async (
	inputPath: string,
	options: MergeCommandOptions,
): Promise<void> => {
	const logger = new Logger({ logLevel: options.logLevel });
	const merger = new SqlMerger({
		logger,
		validateSourceOrder: options.validateSourceOrder ?? true,
		allowExternalReferences: options.allowExternalReferences ?? false,
		defaultSchema: options.defaultSchema,
	});
	logger.info('🔧 SQL Merger');

	const plan = merger.planDirectory(resolve(inputPath), options.dialect);
	renderDiagnostics(logger, plan);
	const merged = merger.merge(plan, {
		addComments: true,
		includeHeader: true,
		separateStatements: true,
	});

	if (options.output) {
		try {
			writeFileSync(options.output, merged, 'utf-8');
			logger.info(`💾 Output written to: ${options.output}`);
		} catch (error) {
			throw FileSystemError.fileWriteFailed(
				options.output,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	} else {
		process.stdout.write(merged.endsWith('\n') ? merged : `${merged}\n`);
	}

	logger.success('Merge completed successfully');
};

import { resolve } from 'node:path';
import {
	Logger,
	type LogLevel,
	renderDiagnostics,
	renderValidationSummary,
	type SqlDialect,
	SqlMerger,
} from '@sqlsmith/core';

export type ValidateCommandOptions = {
	dialect: SqlDialect;
	logLevel: LogLevel;
	allowExternalReferences?: boolean;
	defaultSchema?: string;
};

export const executeValidateCommand = async (
	inputPath: string,
	options: ValidateCommandOptions,
): Promise<void> => {
	const logger = new Logger({ logLevel: options.logLevel });
	const merger = new SqlMerger({
		logger,
		allowExternalReferences: options.allowExternalReferences ?? false,
		defaultSchema: options.defaultSchema,
	});
	logger.header('✅ SQL Validator');

	const plan = merger.planDirectory(resolve(inputPath), options.dialect);
	renderDiagnostics(logger, plan);
	renderValidationSummary(logger, plan);
};

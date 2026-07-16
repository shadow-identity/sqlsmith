import { resolve } from 'node:path';
import {
	Logger,
	type LogLevel,
	type SqlDialect,
	SqlMerger,
} from '@sqlsmith/core';
import { renderDiagnostics, renderValidationSummary } from './renderers.js';

export type ValidateCommandOptions = {
	dialect: SqlDialect;
	logLevel: LogLevel;
	allowExternalReferences?: boolean;
};

export const executeValidateCommand = async (
	inputPath: string,
	options: ValidateCommandOptions,
): Promise<void> => {
	const logger = new Logger({ logLevel: options.logLevel });
	const merger = new SqlMerger({
		logger,
		allowExternalReferences: options.allowExternalReferences ?? false,
	});
	logger.header('✅ SQL Validator');

	const plan = merger.planDirectory(resolve(inputPath), options.dialect);
	renderDiagnostics(logger, plan);
	renderValidationSummary(logger, plan);
};

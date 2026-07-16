import { resolve } from 'node:path';
import {
	Logger,
	type LogLevel,
	renderDependencyGraph,
	renderDiagnostics,
	renderRecommendedOrder,
	type SqlDialect,
	SqlMerger,
} from '@sqlsmith/core';

export type InfoCommandOptions = {
	dialect: SqlDialect;
	logLevel: LogLevel;
	allowExternalReferences?: boolean;
	defaultSchema?: string;
};

export const executeInfoCommand = async (
	inputPath: string,
	options: InfoCommandOptions,
): Promise<void> => {
	const logger = new Logger({ logLevel: options.logLevel });
	const merger = new SqlMerger({
		logger,
		allowExternalReferences: options.allowExternalReferences ?? false,
		defaultSchema: options.defaultSchema,
	});
	logger.header('🔍 SQL Dependency Analyzer');

	const plan = merger.planDirectory(resolve(inputPath), options.dialect);
	renderDiagnostics(logger, plan);
	renderDependencyGraph(logger, plan);
	renderRecommendedOrder(logger, plan);
};

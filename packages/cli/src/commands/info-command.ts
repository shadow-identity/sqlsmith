import { resolve } from 'node:path';
import {
	Logger,
	type LogLevel,
	type SqlDialect,
	SqlMerger,
} from '@sqlsmith/core';
import {
	renderDependencyGraph,
	renderDiagnostics,
	renderRecommendedOrder,
} from './renderers.js';

export type InfoCommandOptions = {
	dialect: SqlDialect;
	logLevel: LogLevel;
	allowExternalReferences?: boolean;
};

export const executeInfoCommand = async (
	inputPath: string,
	options: InfoCommandOptions,
): Promise<void> => {
	const logger = new Logger({ logLevel: options.logLevel });
	const merger = new SqlMerger({
		logger,
		allowExternalReferences: options.allowExternalReferences ?? false,
	});
	logger.header('🔍 SQL Dependency Analyzer');

	const plan = merger.planDirectory(resolve(inputPath), options.dialect);
	renderDiagnostics(logger, plan);
	renderDependencyGraph(logger, plan);
	renderRecommendedOrder(logger, plan);
};

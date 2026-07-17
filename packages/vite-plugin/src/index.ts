import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import {
	FileSystemError,
	Logger,
	type LogLevel,
	type MergeDiagnostic,
	renderDependencyGraph,
	renderDiagnostic,
	renderDiscoveredFiles,
	renderRecommendedOrder,
	type SqlDialect,
	SqlMerger,
} from '@sqlsmith/core';
import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';

export interface SqlsmithPluginOptions {
	input: string;
	output: string;
	dialect?: SqlDialect;
	watch?: boolean;
	logLevel?: LogLevel;
	allowExternalReferences?: boolean;
	defaultSchema?: string;
}

export const sqlsmith = (options: SqlsmithPluginOptions): Plugin => {
	const input = resolve(options.input);
	const output = resolve(options.output);
	const dialect = options.dialect ?? 'postgresql';
	const logger = new Logger({ logLevel: options.logLevel ?? 'info' });
	const merger = new SqlMerger({
		logger,
		allowExternalReferences: options.allowExternalReferences ?? false,
		defaultSchema: options.defaultSchema,
	});
	let command: 'build' | 'serve' = 'build';
	let watchEnabled = options.watch ?? false;
	// Keys of the last successful plan's diagnostics; a failed rebuild leaves
	// the set untouched, matching the preserved last-good output.
	let knownDiagnosticKeys = new Set<string>();

	const isWithinInput = (candidate: string): boolean => {
		const pathFromInput = relative(input, resolve(candidate));
		return (
			pathFromInput === '' ||
			(!pathFromInput.startsWith('..') && !isAbsolute(pathFromInput))
		);
	};

	const isRelevantSql = (candidate: string): boolean =>
		candidate.toLowerCase().endsWith('.sql') &&
		isWithinInput(candidate) &&
		resolve(candidate) !== output;

	const diagnosticKey = (diagnostic: MergeDiagnostic): string => {
		switch (diagnostic.code) {
			case 'EXTERNAL_REFERENCE':
				return `${diagnostic.code}|${diagnostic.statementKey}|${diagnostic.dependencyKey}`;
			case 'RAW_CROSS_FILE_REFERENCE':
				return `${diagnostic.code}|${diagnostic.statementName}|${diagnostic.dependencyKey}`;
			default:
				return `${diagnostic.code}|${[...diagnostic.statements].sort().join(' ')}`;
		}
	};

	const renderNewDiagnostics = (
		diagnostics: readonly MergeDiagnostic[],
	): void => {
		if (logger.isLevelEnabled('debug')) {
			for (const diagnostic of diagnostics)
				renderDiagnostic(logger, diagnostic);
			return;
		}
		let knownCount = 0;
		for (const diagnostic of diagnostics) {
			if (knownDiagnosticKeys.has(diagnosticKey(diagnostic))) knownCount += 1;
			else renderDiagnostic(logger, diagnostic);
		}
		if (knownCount > 0) {
			logger.warn(
				`SQLsmith: ${knownCount} known warning(s) — set logLevel: 'debug' to see all`,
			);
		}
	};

	const writeAtomically = (content: string): void => {
		const temporaryOutput = `${output}.${process.pid}.tmp`;
		try {
			writeFileSync(temporaryOutput, content, 'utf8');
			renameSync(temporaryOutput, output);
		} catch (error) {
			if (existsSync(temporaryOutput)) unlinkSync(temporaryOutput);
			throw FileSystemError.fileWriteFailed(
				output,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	};

	const generate = (context: PluginContext): void => {
		context.addWatchFile(input);
		const plan = merger.planDirectory(input, dialect, {
			recursive: true,
			exclude: [output],
		});

		for (const file of plan.files) context.addWatchFile(file.path);

		if (logger.isLevelEnabled('debug')) {
			renderDiscoveredFiles(logger, plan);
			renderDependencyGraph(logger, plan);
			renderRecommendedOrder(logger, plan);
		}

		renderNewDiagnostics(plan.diagnostics);

		const merged = merger.merge(plan, {
			addComments: true,
			includeHeader: true,
			separateStatements: true,
		});
		writeAtomically(merged);
		knownDiagnosticKeys = new Set(plan.diagnostics.map(diagnosticKey));
		logger.success(`SQLsmith: Schema updated -> ${output}`);
	};

	const runAtBoundary = (context: PluginContext): void => {
		try {
			generate(context);
		} catch (error) {
			if (command === 'serve') {
				context.error(error instanceof Error ? error : String(error));
				return;
			}
			throw error;
		}
	};

	return {
		name: 'sqlsmith',

		configResolved(config) {
			command = config.command;
			watchEnabled = options.watch ?? command === 'serve';
		},

		buildStart() {
			runAtBoundary(this);
		},

		watchChange(id) {
			if (!watchEnabled || !isRelevantSql(id)) return;
			runAtBoundary(this);
		},
	};
};

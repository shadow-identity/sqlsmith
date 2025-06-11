import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger, SqlMerger } from '@sqlsmith/core';
import type { PluginContext } from 'rollup';
import type { HmrContext, Plugin } from 'vite';

export interface SqlsmithPluginOptions {
	input: string;
	output: string;
	dialect?: 'postgresql' | 'mysql' | 'sqlite' | 'bigquery';
	watch?: boolean;
	logLevel?: 'silent' | 'error' | 'normal' | 'verbose';
}

export const sqlsmith = (options: SqlsmithPluginOptions): Plugin => {
	const merger = new SqlMerger();

	// Convert logLevel to logger options
	const getLogLevel = (logLevel: string = 'normal') => {
		switch (logLevel) {
			case 'silent':
				return 'error';
			case 'error':
				return 'error';
			case 'verbose':
				return 'debug';
			case 'normal':
			default:
				return 'info';
		}
	};

	const logger = new Logger({ logLevel: getLogLevel(options.logLevel) });
	const isErrorOnly = options.logLevel === 'error';
	const isSilent = options.logLevel === 'silent';
	let sqlFiles: string[] = [];
	let pluginContext: PluginContext;

	return {
		name: 'sqlsmith',

		configResolved(config) {
			// Auto-enable watching in dev mode
			if (options.watch === undefined) {
				options.watch = config.command === 'serve';
			}
		},

		buildStart() {
			pluginContext = this;

			if (isSilent) {
				return;
			}

			sqlFiles = discoverSqlFiles(options.input);
			handleSqlChanges(sqlFiles, logger, options, pluginContext);
		},

		async handleHotUpdate(ctx: HmrContext) {
			// First, check for deleted SQL files and clean up
			const deletedFiles = sqlFiles.filter((file) => !existsSync(file));
			if (deletedFiles.length > 0) {
				deletedFiles.forEach((file) => {
					if (!isErrorOnly && !isSilent) {
						logger.info(`🗑️ SQLsmith: SQL file deleted -> ${file}`);
					}
				});
				sqlFiles = sqlFiles.filter((file) => existsSync(file));
				handleSqlChanges(sqlFiles, logger, options, pluginContext);
				return [];
			}

			// Check if the changed file is a SQL file in our input directory
			if (ctx.file.endsWith('.sql') && isFileInInputDirectory(ctx.file)) {
				// If it's a new SQL file, add it to our tracking
				if (!sqlFiles.includes(ctx.file)) {
					sqlFiles.push(ctx.file);
					if (!isErrorOnly && !isSilent) {
						logger.info(`📁 SQLsmith: New SQL file detected -> ${ctx.file}`);
					}
				}

				// Regenerate schema when SQL files change
				handleSqlChanges(sqlFiles, logger, options, pluginContext);

				// Return empty array to prevent default HMR behavior
				// since we're handling schema generation ourselves
				return [];
			}
		},
	};

	function handleSqlChanges(
		sqlFiles: string[],
		logger: Logger,
		options: SqlsmithPluginOptions,
		pluginContext: PluginContext,
	) {
		if (!sqlFiles.length) {
			logger.warn('No SQL files found.');
			return;
		}

		// Register SQL files with Vite's watcher
		if (options.watch) {
			sqlFiles.forEach((file) => {
				pluginContext.addWatchFile(file);
			});
		}

		try {
			const resolvedInput = resolve(options.input);
			const parsedFiles = merger.parseSqlFiles(
				resolvedInput,
				options.dialect || 'postgresql',
			);

			merger.mergeFiles(parsedFiles, {
				addComments: true,
				includeHeader: true,
				separateStatements: true,
				outputPath: options.output,
			});

			if (!isErrorOnly && !isSilent) {
				logger.success(`SQLsmith: Schema updated -> ${options.output}`);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (!isSilent) {
				logger.error(`SQLsmith: Schema merge failed - ${errorMsg}`);
			}

			// In dev mode, don't throw - just log the error
			if (!options.watch) {
				throw error;
			}

			pluginContext.error(String(error));
		}
	}

	function discoverSqlFiles(inputPath: string): string[] {
		const files: string[] = [];
		const resolvedPath = resolve(inputPath);

		if (!existsSync(resolvedPath)) {
			if (!isErrorOnly && !isSilent) {
				logger.warn(`SQLsmith: Input path does not exist: ${resolvedPath}`);
			}
			return files;
		}

		const discoverRecursive = (dir: string) => {
			const entries = readdirSync(dir);

			for (const entry of entries) {
				const fullPath = resolve(dir, entry);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					discoverRecursive(fullPath);
				} else if (entry.endsWith('.sql')) {
					files.push(fullPath);
				}
			}
		};

		const stat = statSync(resolvedPath);
		if (stat.isDirectory()) {
			discoverRecursive(resolvedPath);
		} else if (resolvedPath.endsWith('.sql')) {
			files.push(resolvedPath);
		}

		logger.debug(`SQLsmith: Discovered ${files.length} SQL files`);
		return files;
	}

	function isFileInInputDirectory(filePath: string): boolean {
		const resolvedInput = resolve(options.input);
		const resolvedFile = resolve(filePath);

		// Check if the file is within the input directory
		return resolvedFile.startsWith(resolvedInput);
	}
};

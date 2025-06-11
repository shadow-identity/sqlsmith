import { Logger, SqlMerger } from '@sqlsmith/core';
import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
export const sqlsmith = (options) => {
    const merger = new SqlMerger();
    // Convert logLevel to logger options
    const getLogLevel = (logLevel = 'normal') => {
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
    let sqlFiles = [];
    let pluginContext;
    return {
        name: 'sqlsmith',
        configResolved(config) {
            // Auto-enable watching in dev mode
            if (options.watch === undefined) {
                options.watch = config.command === 'serve';
            }
        },
        buildStart() {
            // Store plugin context for later use
            pluginContext = this;
            // Discover and register SQL files for watching
            sqlFiles = discoverSqlFiles(options.input);
            // Register SQL files with Vite's watcher
            if (options.watch) {
                sqlFiles.forEach((file) => {
                    this.addWatchFile(file);
                });
            }
            // Initial merge
            return generateSchema();
        },
        async handleHotUpdate(ctx) {
            // First, check for deleted SQL files and clean up
            const deletedFiles = sqlFiles.filter((file) => !existsSync(file));
            if (deletedFiles.length > 0) {
                deletedFiles.forEach((file) => {
                    if (!isErrorOnly && !isSilent) {
                        logger.info(`🗑️ SQLsmith: SQL file deleted -> ${file}`);
                    }
                });
                sqlFiles = sqlFiles.filter((file) => existsSync(file));
                await generateSchema();
                return [];
            }
            // Check if the changed file is a SQL file in our input directory
            if (ctx.file.endsWith('.sql') && isFileInInputDirectory(ctx.file)) {
                // If it's a new SQL file, add it to our tracking
                if (!sqlFiles.includes(ctx.file)) {
                    sqlFiles.push(ctx.file);
                    if (pluginContext) {
                        pluginContext.addWatchFile(ctx.file);
                    }
                    if (!isErrorOnly && !isSilent) {
                        logger.info(`📁 SQLsmith: New SQL file detected -> ${ctx.file}`);
                    }
                }
                // Regenerate schema when SQL files change
                await generateSchema();
                // Return empty array to prevent default HMR behavior
                // since we're handling schema generation ourselves
                return [];
            }
        },
    };
    async function generateSchema() {
        try {
            const resolvedInput = resolve(options.input);
            const parsedFiles = merger.parseSqlFile(resolvedInput, options.dialect || 'postgresql');
            merger.mergeFiles(parsedFiles, {
                addComments: true,
                includeHeader: true,
                separateStatements: true,
                outputPath: options.output,
            });
            if (!isErrorOnly && !isSilent) {
                logger.success(`SQLsmith: Schema updated -> ${options.output}`);
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (!isSilent) {
                logger.error(`SQLsmith: Schema merge failed - ${errorMsg}`);
            }
            // In dev mode, don't throw - just log the error
            if (!options.watch) {
                throw error;
            }
        }
    }
    function discoverSqlFiles(inputPath) {
        const files = [];
        const resolvedPath = resolve(inputPath);
        if (!existsSync(resolvedPath)) {
            if (!isErrorOnly && !isSilent) {
                logger.warn(`SQLsmith: Input path does not exist: ${resolvedPath}`);
            }
            return files;
        }
        const discoverRecursive = (dir) => {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                const fullPath = resolve(dir, entry);
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                    discoverRecursive(fullPath);
                }
                else if (entry.endsWith('.sql')) {
                    files.push(fullPath);
                }
            }
        };
        const stat = statSync(resolvedPath);
        if (stat.isDirectory()) {
            discoverRecursive(resolvedPath);
        }
        else if (resolvedPath.endsWith('.sql')) {
            files.push(resolvedPath);
        }
        logger.debug(`SQLsmith: Discovered ${files.length} SQL files`);
        return files;
    }
    function isFileInInputDirectory(filePath) {
        const resolvedInput = resolve(options.input);
        const resolvedFile = resolve(filePath);
        // Check if the file is within the input directory
        return resolvedFile.startsWith(resolvedInput);
    }
};
//# sourceMappingURL=index.js.map
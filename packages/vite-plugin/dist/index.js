import { SqlMerger } from '@sqlsmith/core';
import { watch } from 'chokidar';
import { resolve } from 'path';
export function sqlsmith(options) {
    const merger = new SqlMerger();
    let watcher;
    return {
        name: 'sqlsmith',
        configResolved(config) {
            // Auto-enable watching in dev mode
            if (options.watch === undefined) {
                options.watch = config.command === 'serve';
            }
        },
        buildStart() {
            // Initial merge
            generateSchema();
            // Set up file watching in dev mode
            if (options.watch) {
                setupWatcher();
            }
        },
        buildEnd() {
            // Clean up watcher
            if (watcher) {
                watcher.close();
            }
        },
    };
    async function generateSchema() {
        try {
            const resolvedInput = resolve(options.input);
            const sqlFiles = merger.parseSqlFile(resolvedInput, options.dialect || 'postgresql');
            merger.mergeFiles(sqlFiles, {
                addComments: true,
                includeHeader: true,
                separateStatements: true,
                outputPath: options.output,
            });
            console.log(`✅ SQLsmith: Schema updated -> ${options.output}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ SQLsmith: Schema merge failed - ${errorMsg}`);
            // In dev mode, don't throw - just log the error
            if (!options.watch) {
                throw error;
            }
        }
    }
    function setupWatcher() {
        const watchPattern = resolve(options.input + '/**/*.sql');
        watcher = watch(watchPattern, {
            ignoreInitial: true,
        });
        watcher.on('change', generateSchema);
        watcher.on('add', generateSchema);
        watcher.on('unlink', generateSchema);
        console.log(`👀 SQLsmith: Watching ${watchPattern}`);
    }
}
//# sourceMappingURL=index.js.map
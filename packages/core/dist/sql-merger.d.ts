import type { Logger } from './services/logger.js';
import { ServiceContainer } from './services/service-container.js';
import type { MergeOptions } from './services/sql-file-merger.js';
import type { SqlDialect, SqlFile, SqlStatement } from './types/sql-statement.js';
export interface SqlMergerOptions {
    allowReorderDropComments?: boolean;
    enableViews?: boolean;
    enableSequences?: boolean;
    logger?: Logger;
}
export declare class SqlMerger {
    #private;
    constructor(options?: SqlMergerOptions, container?: ServiceContainer);
    /**
     * Create SqlMerger with service container (preferred way)
     */
    static withContainer(container: ServiceContainer): SqlMerger;
    /**
     * Parse SQL files from a directory
     */
    parseSqlFile(directoryPath: string, dialect?: SqlDialect, options?: SqlMergerOptions): SqlFile[];
    /**
     * Parse a single SQL file
     */
    parseSingleFile(filePath: string, dialect?: SqlDialect, options?: SqlMergerOptions): SqlFile;
    /**
     * Merge SQL files with automatic dependency resolution
     */
    mergeFiles(files: SqlFile[], options?: MergeOptions): string;
    /**
     * Analyze dependencies without merging (info command)
     */
    analyzeDependencies(directoryPath: string, dialect?: SqlDialect): void;
    /**
     * Validate files without merging (validate command)
     */
    validateFiles(directoryPath: string, dialect?: SqlDialect): void;
    /**
     * Get supported statement types
     */
    getSupportedTypes(): string[];
    /**
     * Get service container (for advanced usage)
     */
    getContainer(): ServiceContainer;
}
export type { SqlFile, SqlStatement, SqlDialect, MergeOptions };
export type { Dependency, StatementType } from './types/sql-statement.js';
//# sourceMappingURL=sql-merger.d.ts.map
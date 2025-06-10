import type { SqlFile, SqlStatement } from '../types/sql-statement.js';
import type { Logger } from './logger.js';
export interface MergeOptions {
    addComments?: boolean;
    separateStatements?: boolean;
    includeHeader?: boolean;
    outputPath?: string;
}
export declare class SqlFileMerger {
    #private;
    constructor(logger: Logger);
    /**
     * Merge SQL statements into a single string
     */
    mergeStatements(statements: SqlStatement[], options?: MergeOptions): string;
    /**
     * Merge SQL files (legacy compatibility method)
     */
    mergeFiles(files: SqlFile[], options?: MergeOptions): string;
}
//# sourceMappingURL=sql-file-merger.d.ts.map
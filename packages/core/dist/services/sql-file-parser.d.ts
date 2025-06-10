import type { StatementProcessor } from '../processors/base-processor.js';
import type { ParseResult, SqlDialect, SqlFile } from '../types/sql-statement.js';
export declare class SqlFileParser {
    #private;
    constructor(processors?: StatementProcessor[]);
    addProcessor(processor: StatementProcessor): void;
    /**
     * Find all SQL files in a directory
     */
    findSqlFiles(directoryPath: string): string[];
    /**
     * Parse a directory of SQL files
     */
    parseDirectory(directoryPath: string, dialect?: SqlDialect): SqlFile[];
    /**
     * Parse a single SQL file
     */
    parseFile(filePath: string, dialect?: SqlDialect): SqlFile;
    /**
     * Parse SQL content using registered processors
     */
    parseContent(sql: string, filePath: string, dialect?: SqlDialect): ParseResult;
    /**
     * Get all supported statement types from registered processors
     */
    getSupportedTypes(): string[];
}
//# sourceMappingURL=sql-file-parser.d.ts.map
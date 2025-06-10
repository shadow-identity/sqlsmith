import type { SqlDialect, SqlStatement } from '../types/sql-statement.js';
export interface StatementProcessor {
    /**
     * Check if this processor can handle the given AST statement
     */
    canProcess(statement: any): boolean;
    /**
     * Extract SQL statements from the AST
     */
    extractStatements(ast: any, filePath: string, dialect: SqlDialect): SqlStatement[];
    /**
     * Get the statement types this processor handles
     */
    getHandledTypes(): string[];
}
//# sourceMappingURL=base-processor.d.ts.map
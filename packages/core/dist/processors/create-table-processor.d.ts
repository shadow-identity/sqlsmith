import type { SqlDialect, SqlStatement } from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';
export declare class CreateTableProcessor implements StatementProcessor {
    #private;
    canProcess(statement: any): boolean;
    getHandledTypes(): string[];
    extractStatements(ast: any, filePath: string, dialect: SqlDialect): SqlStatement[];
}
//# sourceMappingURL=create-table-processor.d.ts.map
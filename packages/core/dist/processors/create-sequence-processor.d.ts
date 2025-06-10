import type { SqlDialect, SqlStatement } from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';
export declare class CreateSequenceProcessor implements StatementProcessor {
    canProcess(statement: any): boolean;
    getHandledTypes(): string[];
    extractStatements(ast: any, filePath: string, dialect: SqlDialect): SqlStatement[];
}
//# sourceMappingURL=create-sequence-processor.d.ts.map
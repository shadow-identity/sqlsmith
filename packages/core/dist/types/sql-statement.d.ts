export type StatementType = 'table' | 'view' | 'sequence' | 'index' | 'function';
export type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'bigquery';
export interface Dependency {
    name: string;
    type: StatementType;
}
export interface SqlStatement {
    type: StatementType;
    name: string;
    dependsOn: Dependency[];
    filePath: string;
    content: string;
    lineNumber?: number;
    ast?: any;
}
export interface SqlFile {
    path: string;
    content: string;
    statements: SqlStatement[];
    ast?: any;
}
export interface ParseResult {
    ast: any;
    statements: SqlStatement[];
}
//# sourceMappingURL=sql-statement.d.ts.map
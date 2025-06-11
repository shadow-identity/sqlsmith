import type { AST } from 'node-sql-parser';

export type StatementType =
	| 'table'
	| 'view'
	| 'sequence'
	| 'index'
	| 'function';

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
	ast?: AST;
}

export interface SqlFile {
	path: string;
	content: string;
	statements: SqlStatement[];
	ast?: AST | AST[];
}

export interface ParseResult {
	ast: AST | AST[];
	statements: SqlStatement[];
}

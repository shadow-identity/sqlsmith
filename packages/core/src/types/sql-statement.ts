import type { AST } from 'node-sql-parser';

export type StatementType =
	| 'table'
	| 'view'
	| 'sequence'
	| 'index'
	| 'function'
	/** A statement no processor recognizes; carried through the merge verbatim. */
	| 'raw';

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
	/** 0-based position of the statement within its source file. */
	orderInFile?: number;
	lineNumber?: number;
	ast?: AST;
}

export interface SqlFile {
	path: string;
	content: string;
	statements: SqlStatement[];
	ast?: AST | AST[];
}

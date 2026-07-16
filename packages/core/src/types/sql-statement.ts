import type { AST } from 'node-sql-parser';
import type { RelationIdentifier } from './relation-identifier.js';

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
	/** Canonical relation identity used for matching and graph operations. */
	readonly identifier: RelationIdentifier;
	/** @deprecated Use `identifier.display`; retained as a display-only alias. */
	readonly name: string;
	readonly type: StatementType;
}

export interface SqlStatement {
	type: StatementType;
	/** Present for every recognized relation statement; absent for raw SQL. */
	readonly identifier?: RelationIdentifier;
	/** @deprecated Use `identifier.display`; raw statements retain a synthetic name. */
	readonly name: string;
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

import type { AST } from 'node-sql-parser';
import type { DialectAstAdapter } from '../services/dialect-ast-adapter.js';
import type { LexedRelationName } from '../services/sql-identifier-lexer.js';
import type {
	DialectRules,
	SourceIdentifierPart,
} from '../types/relation-identifier.js';
import type { SqlDialect, SqlStatement } from '../types/sql-statement.js';

export interface StatementProcessorContext {
	readonly source: string;
	readonly dialect: SqlDialect;
	readonly identifierRules: DialectRules;
	readonly dialectAdapter?: DialectAstAdapter;
	readonly relationNames: readonly LexedRelationName[];
	readonly cteAliases: readonly SourceIdentifierPart[];
	/** 0-based position of the statement within its source file. */
	readonly statementIndex?: number;
	readonly lineNumber?: number;
}

export interface StatementProcessor {
	getHandledTypes(): string[];

	/**
	 * Check if this processor can handle the given AST statement
	 */
	canProcess(statement: AST): boolean;

	/**
	 * Extract all statements from the given AST
	 */
	extractStatements(
		ast: AST | AST[],
		filePath: string,
		context?: StatementProcessorContext,
	): SqlStatement[];
}

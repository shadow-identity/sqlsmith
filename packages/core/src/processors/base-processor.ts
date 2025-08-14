import type { AST } from 'node-sql-parser';
import type { SqlStatement } from '../types/sql-statement.js';

export interface StatementProcessor {
	getHandledTypes(): string[];

	/**
	 * Check if this processor can handle the given AST statement
	 */
	canProcess(statement: AST): boolean;

	/**
	 * Extract all statements from the given AST
	 */
	extractStatements(ast: AST | AST[], filePath: string): SqlStatement[];
}

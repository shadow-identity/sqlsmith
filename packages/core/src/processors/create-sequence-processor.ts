import type { AST } from 'node-sql-parser';
import type { SqlDialect, SqlStatement } from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';

export class CreateSequenceProcessor implements StatementProcessor {
	getHandledTypes(): string[] {
		return ['sequence'];
	}

	canProcess(statement: AST): boolean {
		// TODO: The 'keyword' property on the Create type from node-sql-parser
		// doesn't seem to include 'sequence'. Using 'any' for now.
		return (
			statement?.type === 'create' && (statement as any)?.keyword === 'sequence'
		);
	}

	/**
	 * Extracts sequence statements from the given AST.
	 */
	extractStatements(
		ast: AST | AST[],
		filePath: string,
		_dialect: SqlDialect,
	): SqlStatement[] {
		const statements: SqlStatement[] = [];
		const astArray = Array.isArray(ast) ? ast : [ast];

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				// TODO: The Create type from node-sql-parser doesn't have a clear
				// property for the sequence name. Using 'any' for now based on
				// previous implementation.
				const sequenceName = (statement as any).sequence?.[0]?.table;

				if (sequenceName) {
					statements.push({
						type: 'sequence',
						name: sequenceName,
						dependsOn: [], // Sequences typically don't have dependencies
						filePath,
						content: '', // Will be filled by the file parser
						ast: statement,
					});
				}
			}
		}

		return statements;
	}
}

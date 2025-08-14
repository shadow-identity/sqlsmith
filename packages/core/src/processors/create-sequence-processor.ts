import type { AST } from 'node-sql-parser';
import type { SqlStatement } from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';

export class CreateSequenceProcessor implements StatementProcessor {
	getHandledTypes(): string[] {
		return ['sequence'];
	}

	#isCreateSequence = (node: AST): boolean => {
		if (typeof node !== 'object' || node === null) return false;
		const record = node as unknown as Record<string, unknown>;
		return record.type === 'create' && record.keyword === 'sequence';
	};

	canProcess(statement: AST): boolean {
		return this.#isCreateSequence(statement);
	}

	/**
	 * Extracts sequence statements from the given AST.
	 */
	extractStatements(ast: AST | AST[], filePath: string): SqlStatement[] {
		const statements: SqlStatement[] = [];
		const astArray = Array.isArray(ast) ? ast : [ast];

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				const record = statement as unknown as Record<string, unknown>;
				const sequenceName = Array.isArray(record.sequence)
					? (record.sequence as Array<{ table?: string }>).at(0)?.table
					: undefined;

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

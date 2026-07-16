import type { AST } from 'node-sql-parser';
import { getDialectAstAdapter } from '../services/dialect-ast-adapter.js';
import {
	createDialectRules,
	createRelationIdentifier,
	unquotedRelationName,
} from '../types/relation-identifier.js';
import type { SqlStatement } from '../types/sql-statement.js';
import type {
	StatementProcessor,
	StatementProcessorContext,
} from './base-processor.js';

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
	extractStatements(
		ast: AST | AST[],
		filePath: string,
		context?: StatementProcessorContext,
	): SqlStatement[] {
		const statements: SqlStatement[] = [];
		const astArray = Array.isArray(ast) ? ast : [ast];
		const rules = context?.identifierRules ?? createDialectRules('postgresql');
		const adapter =
			context?.dialectAdapter ??
			getDialectAstAdapter(context?.dialect ?? 'postgresql');

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				const declaration = adapter.declaration(statement, 'sequence');
				const source =
					context?.relationNames.find(
						(relation) =>
							relation.role === 'declaration' &&
							relation.statementType === 'sequence',
					) ??
					(declaration
						? unquotedRelationName(declaration.name, declaration.schema)
						: undefined);

				if (source) {
					const identifier = createRelationIdentifier(source, rules);
					statements.push({
						type: 'sequence',
						identifier,
						name: identifier.display,
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

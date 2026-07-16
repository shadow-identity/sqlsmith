import type { AST, Create as CreateView } from 'node-sql-parser';
import { getDialectAstAdapter } from '../services/dialect-ast-adapter.js';
import { collectSelectRelations } from '../services/select-relation-collector.js';
import {
	createDialectRules,
	createRelationIdentifier,
	type DialectRules,
	unquotedRelationName,
} from '../types/relation-identifier.js';
import type { Dependency, SqlStatement } from '../types/sql-statement.js';
import type {
	StatementProcessor,
	StatementProcessorContext,
} from './base-processor.js';

export class CreateViewProcessor implements StatementProcessor {
	getHandledTypes(): string[] {
		return ['view'];
	}

	canProcess(statement: AST): boolean {
		return statement?.type === 'create' && statement?.keyword === 'view';
	}

	/**
	 * Extracts view statements from the given AST.
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
				const source =
					context?.relationNames.find(
						(relation) =>
							relation.role === 'declaration' &&
							relation.statementType === 'view',
					) ??
					(() => {
						const declaration = adapter.declaration(statement, 'view');
						return declaration
							? unquotedRelationName(declaration.name, declaration.schema)
							: undefined;
					})();

				if (source) {
					const dependencies = this.#extractViewDependencies(
						statement as CreateView,
						context,
						rules,
					);
					const identifier = createRelationIdentifier(source, rules);
					statements.push({
						type: 'view',
						identifier,
						name: identifier.display,
						dependsOn: dependencies,
						filePath,
						content: '', // Will be filled by the file parser
						ast: statement,
					});
				}
			}
		}

		return statements;
	}

	#extractViewDependencies(
		statement: CreateView,
		context: StatementProcessorContext | undefined,
		rules: DialectRules,
	): Dependency[] {
		const adapter =
			context?.dialectAdapter ??
			getDialectAstAdapter(context?.dialect ?? 'postgresql');
		const definition = adapter.viewDefinition(statement);
		if (!definition) return [];

		const sourceRelations =
			context?.relationNames.filter(
				(relation) =>
					relation.role === 'reference' &&
					relation.referenceKind !== 'references',
			) ?? [];
		const collection = collectSelectRelations(definition, {
			identifierRules: rules,
			dialectAdapter: adapter,
			sourceRelations,
			sourceCteAliases: context?.cteAliases,
		});

		return [...collection.relations.values()].map((identifier) => ({
			identifier,
			name: identifier.display,
			type: 'table',
		}));
	}
}

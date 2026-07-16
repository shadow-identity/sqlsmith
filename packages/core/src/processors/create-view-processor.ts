import type { AST, Create as CreateView } from 'node-sql-parser';
import { collectSelectRelations } from '../services/select-relation-collector.js';
import {
	createIdentifierRules,
	createRelationIdentifier,
	type IdentifierRules,
	type SourceRelationName,
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
		const rules =
			context?.identifierRules ?? createIdentifierRules('postgresql');

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				const source =
					context?.relationNames.find(
						(relation) =>
							relation.role === 'declaration' &&
							relation.statementType === 'view',
					) ?? this.#extractViewName(statement);

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
		rules: IdentifierRules,
	): Dependency[] {
		const definition = this.#extractViewDefinition(statement);
		if (!definition) return [];

		const sourceRelations =
			context?.relationNames.filter(
				(relation) =>
					relation.role === 'reference' &&
					relation.referenceKind !== 'references',
			) ?? [];
		const collection = collectSelectRelations(definition, {
			identifierRules: rules,
			sourceRelations,
			sourceCteAliases: context?.cteAliases,
		});

		return [...collection.relations.values()].map((identifier) => ({
			identifier,
			name: identifier.display,
			type: 'table',
		}));
	}

	#isCreateNode = (node: AST): boolean => {
		return (
			typeof node === 'object' &&
			node !== null &&
			'type' in node &&
			(node as { type?: unknown }).type === 'create'
		);
	};

	#extractViewName = (node: AST): SourceRelationName | undefined => {
		if (!this.#isCreateNode(node)) return undefined;
		// node-sql-parser emits { view: { db, view } }; older shapes used a
		// plain string at node.view or table[0].table
		const asRecord = node as unknown as Record<string, unknown>;
		const viewField = asRecord.view;
		if (typeof viewField === 'string') return unquotedRelationName(viewField);
		if (viewField && typeof viewField === 'object' && 'view' in viewField) {
			const nested = viewField as { db?: string | null; view?: unknown };
			if (typeof nested.view === 'string') {
				return unquotedRelationName(nested.view, nested.db);
			}
		}
		const tableArr = asRecord.table as
			| Array<{ db?: string | null; table?: string }>
			| undefined;
		const table = tableArr?.at(0);
		return table?.table
			? unquotedRelationName(table.table, table.db)
			: undefined;
	};

	#extractViewDefinition = (node: AST): unknown => {
		if (!this.#isCreateNode(node)) return undefined;
		// node-sql-parser stores the SELECT at node.select; keep the legacy
		// node.definition fallback
		const asRecord = node as unknown as Record<string, unknown>;
		return asRecord.select ?? asRecord.definition;
	};
}

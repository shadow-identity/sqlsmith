import type { AST, Create as CreateTable } from 'node-sql-parser';
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

export class CreateTableProcessor implements StatementProcessor {
	canProcess(statement: AST): boolean {
		return statement?.type === 'create' && statement?.keyword === 'table';
	}

	getHandledTypes(): string[] {
		return ['table'];
	}

	extractStatements(
		ast: AST | AST[],
		filePath: string,
		context?: StatementProcessorContext,
	): SqlStatement[] {
		const statements: SqlStatement[] = [];
		const rules =
			context?.identifierRules ?? createIdentifierRules('postgresql');

		const astArray = Array.isArray(ast) ? ast : [ast];

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				const dependencies = this.#extractTableDependencies(
					statement as CreateTable,
					context,
					rules,
				);
				const tableReference = (statement as CreateTable).table?.[0] as
					| { db?: string | null; table?: string }
					| undefined;
				const source =
					context?.relationNames.find(
						(relation) =>
							relation.role === 'declaration' &&
							relation.statementType === 'table',
					) ??
					(tableReference?.table
						? unquotedRelationName(tableReference.table, tableReference.db)
						: undefined);

				if (source) {
					const identifier = createRelationIdentifier(source, rules);
					statements.push({
						type: 'table',
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

	#extractTableDependencies(
		statement: CreateTable,
		context: StatementProcessorContext | undefined,
		rules: IdentifierRules,
	): Dependency[] {
		const dependencies: Dependency[] = [];
		const seen = new Set<string>();
		const lexicalReferences =
			context?.relationNames.filter(
				(relation) =>
					relation.role === 'reference' &&
					relation.referenceKind === 'references',
			) ?? [];
		let referenceIndex = 0;

		if (statement.create_definitions) {
			for (const definition of statement.create_definitions) {
				// Both constraint-level FOREIGN KEYs and column-level REFERENCES
				// carry a reference_definition — one check covers both shapes.
				if (
					'reference_definition' in definition &&
					definition.reference_definition &&
					Array.isArray(definition.reference_definition.table)
				) {
					for (const tbl of definition.reference_definition.table) {
						const astTable = tbl as { db?: string | null; table?: string };
						const source: SourceRelationName | undefined =
							lexicalReferences[referenceIndex++] ??
							(astTable.table
								? unquotedRelationName(astTable.table, astTable.db)
								: undefined);
						if (!source) continue;
						const identifier = createRelationIdentifier(source, rules);
						if (seen.has(identifier.key)) continue;
						seen.add(identifier.key);
						dependencies.push({
							identifier,
							name: identifier.display,
							type: 'table',
						});
					}
				}
			}
		}

		return dependencies;
	}
}

import type { AST } from 'node-sql-parser';
import { getDialectAstAdapter } from '../services/dialect-ast-adapter.js';
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
		const rules = context?.identifierRules ?? createDialectRules('postgresql');
		const adapter =
			context?.dialectAdapter ??
			getDialectAstAdapter(context?.dialect ?? 'postgresql');

		const astArray = Array.isArray(ast) ? ast : [ast];

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				const dependencies = this.#extractTableDependencies(
					statement,
					context,
					rules,
				);
				const declaration = adapter.declaration(statement, 'table');
				const source =
					context?.relationNames.find(
						(relation) =>
							relation.role === 'declaration' &&
							relation.statementType === 'table',
					) ??
					(declaration
						? unquotedRelationName(declaration.name, declaration.schema)
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
		statement: AST,
		context: StatementProcessorContext | undefined,
		rules: DialectRules,
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
		const adapter =
			context?.dialectAdapter ??
			getDialectAstAdapter(context?.dialect ?? 'postgresql');

		for (const reference of adapter.tableReferences(statement)) {
			const source =
				lexicalReferences[referenceIndex++] ??
				unquotedRelationName(reference.name, reference.schema);
			const identifier = createRelationIdentifier(source, rules);
			if (seen.has(identifier.key)) continue;
			seen.add(identifier.key);
			dependencies.push({
				identifier,
				name: identifier.display,
				type: 'table',
			});
		}

		return dependencies;
	}
}

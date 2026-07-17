import type { AST } from 'node-sql-parser';
import { getDialectAstAdapter } from '../services/dialect-ast-adapter.js';
import {
	createDialectRules,
	createRelationIdentifier,
	createSecondaryIdentifier,
	unquotedRelationName,
} from '../types/relation-identifier.js';
import type { SqlStatement } from '../types/sql-statement.js';
import type {
	StatementProcessor,
	StatementProcessorContext,
} from './base-processor.js';

export class CreateIndexProcessor implements StatementProcessor {
	canProcess(statement: AST): boolean {
		return statement?.type === 'create' && statement?.keyword === 'index';
	}

	getHandledTypes(): string[] {
		return ['index'];
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
			if (!this.canProcess(statement)) continue;
			const declaration = adapter.indexDeclaration(statement);

			const tableSource =
				context?.relationNames.find(
					(relation) =>
						relation.role === 'reference' && relation.referenceKind === 'on',
				) ??
				(declaration?.table
					? unquotedRelationName(
							declaration.table.name,
							declaration.table.schema,
						)
					: undefined);
			// Without a target table there is nothing to order against — leave the
			// statement to raw passthrough rather than guessing.
			if (!tableSource) continue;
			const tableIdentifier = createRelationIdentifier(tableSource, rules);

			const nameSource =
				context?.relationNames.find(
					(relation) =>
						relation.role === 'declaration' &&
						relation.statementType === 'index',
				) ??
				(declaration?.name
					? unquotedRelationName(declaration.name.name, declaration.name.schema)
					: undefined);

			const fileName = filePath.split('/').pop() ?? filePath;
			const position = (context?.statementIndex ?? 0) + 1;
			// Index names get their own namespace, discriminated by target table
			// (MySQL scopes index names per table). Unnamed indexes fall back to a
			// per-statement synthetic identity that can never collide.
			const identifier = nameSource
				? createSecondaryIdentifier('index', nameSource, rules, [
						tableIdentifier.key,
					])
				: createSecondaryIdentifier(
						'statement',
						unquotedRelationName(
							`index on ${tableIdentifier.display} (${fileName}#${position})`,
						),
						rules,
						[filePath, String(context?.statementIndex ?? 0)],
					);

			statements.push({
				type: 'index',
				identifier,
				name: identifier.display,
				dependsOn: [
					{
						identifier: tableIdentifier,
						name: tableIdentifier.display,
						type: 'table',
					},
				],
				filePath,
				content: '', // Will be filled by the file parser
				ast: statement,
			});
		}

		return statements;
	}
}

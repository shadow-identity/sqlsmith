import type { AST } from 'node-sql-parser';
import { getDialectAstAdapter } from '../services/dialect-ast-adapter.js';
import {
	createDialectRules,
	createRelationIdentifier,
	createSecondaryIdentifier,
	unquotedRelationName,
} from '../types/relation-identifier.js';
import type { Dependency, SqlStatement } from '../types/sql-statement.js';
import type {
	StatementProcessor,
	StatementProcessorContext,
} from './base-processor.js';

export class AlterTableProcessor implements StatementProcessor {
	canProcess(statement: AST): boolean {
		// sqlite's ALTER AST has no `keyword`; the table array is the reliable
		// marker and also excludes ALTER SEQUENCE / ALTER INDEX (kept raw).
		return (
			statement?.type === 'alter' &&
			Array.isArray((statement as { table?: unknown }).table)
		);
	}

	getHandledTypes(): string[] {
		return ['alter'];
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

			const astTarget = adapter.alterTarget(statement);
			const targetSource =
				context?.relationNames.find(
					(relation) =>
						relation.role === 'reference' && relation.referenceKind === 'alter',
				) ??
				(astTarget
					? unquotedRelationName(astTarget.name, astTarget.schema)
					: undefined);
			if (!targetSource) continue;
			const targetIdentifier = createRelationIdentifier(targetSource, rules);

			const dependencies: Dependency[] = [
				{
					identifier: targetIdentifier,
					name: targetIdentifier.display,
					type: 'table',
				},
			];
			const seen = new Set<string>([targetIdentifier.key]);
			const lexicalReferences =
				context?.relationNames.filter(
					(relation) =>
						relation.role === 'reference' &&
						relation.referenceKind === 'references',
				) ?? [];
			let referenceIndex = 0;
			for (const reference of adapter.alterReferences(statement)) {
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

			// ALTER declares nothing of its own; a per-statement synthetic identity
			// keeps it out of the relation namespace and duplicate validation.
			const fileName = filePath.split('/').pop() ?? filePath;
			const position = (context?.statementIndex ?? 0) + 1;
			const identifier = createSecondaryIdentifier(
				'statement',
				unquotedRelationName(
					`alter ${targetIdentifier.display} (${fileName}#${position})`,
				),
				rules,
				[filePath, String(context?.statementIndex ?? 0)],
			);

			statements.push({
				type: 'alter',
				identifier,
				name: identifier.display,
				dependsOn: dependencies,
				filePath,
				content: '', // Will be filled by the file parser
				ast: statement,
			});
		}

		return statements;
	}
}

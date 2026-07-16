import type { AST, Create as CreateView, Select } from 'node-sql-parser';
import type { Dependency, SqlStatement } from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';

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
	extractStatements(ast: AST | AST[], filePath: string): SqlStatement[] {
		const statements: SqlStatement[] = [];
		const astArray = Array.isArray(ast) ? ast : [ast];

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				const viewName = this.#extractViewName(statement);

				if (viewName) {
					const dependencies = this.#extractViewDependencies(
						statement as CreateView,
					);
					statements.push({
						type: 'view',
						name: viewName,
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

	#extractViewDependencies(statement: CreateView): Dependency[] {
		const dependencies: Dependency[] = [];

		const definition = this.#extractViewDefinition(statement);
		if (definition) {
			const selectStatement = definition as Select;
			const tables = this.#extractTableReferencesFromSelect(selectStatement);

			for (const table of tables) {
				dependencies.push({
					name: table,
					type: 'table',
				});
			}
		}

		return dependencies;
	}

	#isCreateNode = (node: AST): boolean => {
		return (
			typeof node === 'object' &&
			node !== null &&
			'type' in node &&
			(node as { type?: unknown }).type === 'create'
		);
	};

	#extractViewName = (node: AST): string | undefined => {
		if (!this.#isCreateNode(node)) return undefined;
		// node-sql-parser emits { view: { db, view } }; older shapes used a
		// plain string at node.view or table[0].table
		const asRecord = node as unknown as Record<string, unknown>;
		const viewField = asRecord.view;
		if (typeof viewField === 'string') return viewField;
		if (viewField && typeof viewField === 'object' && 'view' in viewField) {
			const nested = (viewField as { view?: unknown }).view;
			if (typeof nested === 'string') return nested;
		}
		const tableArr = asRecord.table as Array<{ table?: string }> | undefined;
		return tableArr?.at(0)?.table;
	};

	#extractViewDefinition = (node: AST): unknown => {
		if (!this.#isCreateNode(node)) return undefined;
		// node-sql-parser stores the SELECT at node.select; keep the legacy
		// node.definition fallback
		const asRecord = node as unknown as Record<string, unknown>;
		return asRecord.select ?? asRecord.definition;
	};

	#extractTableReferencesFromSelect(selectStatement: Select): string[] {
		const tables: string[] = [];

		if (selectStatement.from && Array.isArray(selectStatement.from)) {
			for (const from of selectStatement.from) {
				if ('table' in from && from.table) {
					tables.push(from.table);
				}
			}
		}

		return tables;
	}
}

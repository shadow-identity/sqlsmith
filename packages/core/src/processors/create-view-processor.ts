import type { AST, Create as CreateView, Select } from 'node-sql-parser';
import type {
	Dependency,
	SqlDialect,
	SqlStatement,
} from '../types/sql-statement.js';
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
	extractStatements(
		ast: AST | AST[],
		filePath: string,
		dialect: SqlDialect,
	): SqlStatement[] {
		const statements: SqlStatement[] = [];
		const astArray = Array.isArray(ast) ? ast : [ast];

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				// TODO: The Create type from node-sql-parser doesn't have a 'view'
				// property. Using 'any' for now.
				const viewName = (statement as any).view;

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

		// TODO: The Create type from node-sql-parser doesn't have a 'definition'
		// property for views. Using 'any' for now.
		const definition = (statement as any).definition;
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

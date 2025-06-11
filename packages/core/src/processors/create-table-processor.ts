import type { AST, Create as CreateTable } from 'node-sql-parser';
import type {
	Dependency,
	SqlDialect,
	SqlStatement,
} from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';

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
		dialect: SqlDialect,
	): SqlStatement[] {
		const statements: SqlStatement[] = [];

		const astArray = Array.isArray(ast) ? ast : [ast];

		for (const statement of astArray) {
			if (this.canProcess(statement)) {
				const dependencies = this.#extractTableDependencies(
					statement as CreateTable,
				);

				const tableName = (statement as CreateTable).table?.[0]?.table;

				if (tableName) {
					statements.push({
						type: 'table',
						name: tableName,
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

	#extractTableDependencies(statement: CreateTable): Dependency[] {
		const dependencies: Dependency[] = [];

		if (statement.create_definitions) {
			for (const definition of statement.create_definitions) {
				// Constraint-level FOREIGN KEY (e.g. `FOREIGN KEY (...) REFERENCES other(id)`)
				if (
					'constraint_type' in definition &&
					definition.constraint_type === 'FOREIGN KEY' &&
					'reference_definition' in definition &&
					definition.reference_definition &&
					Array.isArray(definition.reference_definition.table)
				) {
					for (const tbl of definition.reference_definition.table) {
						if (tbl?.table) {
							dependencies.push({
								name: tbl.table,
								type: 'table',
							});
						}
					}
				}

				// Column-level `REFERENCES other(id)`
				if (
					'reference_definition' in definition &&
					definition.reference_definition &&
					Array.isArray(definition.reference_definition.table)
				) {
					for (const tbl of definition.reference_definition.table) {
						if (tbl?.table) {
							dependencies.push({
								name: tbl.table,
								type: 'table',
							});
						}
					}
				}
			}
		}

		return dependencies;
	}
}

import type { AST, Create as CreateTable } from 'node-sql-parser';
import type { Dependency, SqlStatement } from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';

export class CreateTableProcessor implements StatementProcessor {
	canProcess(statement: AST): boolean {
		return statement?.type === 'create' && statement?.keyword === 'table';
	}

	getHandledTypes(): string[] {
		return ['table'];
	}

	extractStatements(ast: AST | AST[], filePath: string): SqlStatement[] {
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
		const seen = new Set<string>();

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
						if (tbl?.table && !seen.has(tbl.table)) {
							seen.add(tbl.table);
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

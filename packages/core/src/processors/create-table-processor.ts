import type {
	Dependency,
	SqlDialect,
	SqlStatement,
} from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';

export class CreateTableProcessor implements StatementProcessor {
	canProcess(statement: any): boolean {
		return statement?.type === 'create' && statement?.keyword === 'table';
	}

	getHandledTypes(): string[] {
		return ['table'];
	}

	extractStatements(
		ast: any,
		filePath: string,
		dialect: SqlDialect,
	): SqlStatement[] {
		const statements: SqlStatement[] = [];
		const astStatements = Array.isArray(ast) ? ast : [ast];

		for (const statement of astStatements) {
			if (this.canProcess(statement)) {
				const tableName = statement.table?.[0]?.table || statement.table?.table;

				if (tableName) {
					const dependencies = this.#extractTableDependencies(statement);

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

	#extractTableDependencies(statement: any): Dependency[] {
		const dependencies: Dependency[] = [];

		// Look for FOREIGN KEY constraints in create_definitions
		if (statement.create_definitions) {
			for (const item of statement.create_definitions) {
				// Handle FOREIGN KEY constraints
				if (
					item.constraint_type === 'FOREIGN KEY' &&
					item.reference_definition
				) {
					const refTable =
						item.reference_definition.table?.[0]?.table ||
						item.reference_definition.table?.table;

					if (refTable && !dependencies.find((d) => d.name === refTable)) {
						dependencies.push({
							name: refTable,
							type: 'table',
						});
					}
				}

				// Handle column-level REFERENCES
				if (item.resource === 'column' && item.reference_definition) {
					const refTable =
						item.reference_definition.table?.[0]?.table ||
						item.reference_definition.table?.table;

					if (refTable && !dependencies.find((d) => d.name === refTable)) {
						dependencies.push({
							name: refTable,
							type: 'table',
						});
					}
				}
			}
		}

		return dependencies;
	}
}

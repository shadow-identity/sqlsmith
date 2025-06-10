import type {
	Dependency,
	SqlDialect,
	SqlStatement,
} from '../types/sql-statement.js';
import type { StatementProcessor } from './base-processor.js';

export class CreateSequenceProcessor implements StatementProcessor {
	canProcess(statement: any): boolean {
		return statement?.type === 'create' && statement?.keyword === 'sequence';
	}

	getHandledTypes(): string[] {
		return ['sequence'];
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
				const sequenceName = statement.sequence?.[0]?.table || 
								   statement.sequence?.table || 
								   statement.name;

				if (sequenceName) {
					// Sequences typically have no dependencies - they're usually created first
					const dependencies: Dependency[] = [];

					statements.push({
						type: 'sequence',
						name: sequenceName,
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
}

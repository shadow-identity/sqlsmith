import type { SqlStatement } from '../types/sql-statement.js';

export interface MergeOptions {
	addComments?: boolean;
	separateStatements?: boolean;
	includeHeader?: boolean;
}

/**
 * Emits SQL statements in the order given (statement-level, not file-level).
 * Pure computation: returns the merged string, never touches stdout or the
 * file system.
 */
export class SqlFileMerger {
	/**
	 * Merge SQL statements into a single string
	 */
	mergeStatements(
		statements: SqlStatement[],
		options: MergeOptions = {},
	): string {
		const {
			addComments = true,
			separateStatements = true,
			includeHeader = true,
		} = options;

		if (statements.length === 0) {
			return '';
		}

		const blocks: string[] = [];

		if (includeHeader) {
			blocks.push(this.#buildHeader(statements));
		}

		for (const statement of statements) {
			let block = '';
			if (addComments) {
				block += `${this.#buildStatementComment(statement)}\n`;
			}
			block += this.#ensureTerminated(statement.content.trim());
			blocks.push(block);
		}

		return blocks.join(separateStatements ? '\n\n' : '\n');
	}

	#buildHeader(statements: SqlStatement[]): string {
		const timestamp = new Date().toISOString();
		const uniqueFiles = new Set(
			statements.map((s) => s.filePath.split('/').pop()),
		).size;
		const order = statements
			.map((statement) =>
				statement.type === 'raw'
					? `raw:${statement.name}`
					: `${statement.type}:${this.#displayName(statement)}`,
			)
			.join(' → ');

		return `-- SQLsmith Output
-- Generated: ${timestamp}
-- Files processed: ${uniqueFiles}
-- Statements merged: ${statements.length}
-- Order: ${order}
`;
	}

	#buildStatementComment(statement: SqlStatement): string {
		const fileName = statement.filePath.split('/').pop() || 'unknown';

		if (statement.type === 'raw') {
			return `-- raw statement (from ${fileName})`;
		}

		const deps =
			statement.dependsOn.length > 0
				? ` — depends on: ${statement.dependsOn
						.map((dependency) => dependency.identifier.display)
						.join(', ')}`
				: '';
		return `-- ${statement.type}: ${this.#displayName(statement)} (from ${fileName})${deps}`;
	}

	#displayName(statement: SqlStatement): string {
		return statement.identifier?.display ?? statement.name;
	}

	#ensureTerminated(content: string): string {
		// already ends with `;`, possibly followed by trailing comments
		if (/;\s*(?:--[^\n]*\s*)*$/.test(content)) {
			return content;
		}
		return `${content};`;
	}
}

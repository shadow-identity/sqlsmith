import type { SqlStatement } from '../types/sql-statement.js';
import type { Logger } from './logger.js';

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
	#logger: Logger;

	constructor(logger: Logger) {
		this.#logger = logger;
	}

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

		const mergedContent = blocks.join(separateStatements ? '\n\n' : '\n');

		this.#logMergeResults(statements, mergedContent);

		return mergedContent;
	}

	#buildHeader(statements: SqlStatement[]): string {
		const timestamp = new Date().toISOString();
		const uniqueFiles = new Set(
			statements.map((s) => s.filePath.split('/').pop()),
		).size;
		const order = statements
			.map((s) => (s.type === 'raw' ? `raw:${s.name}` : `${s.type}:${s.name}`))
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
				? ` — depends on: ${statement.dependsOn.map((d) => d.name).join(', ')}`
				: '';
		return `-- ${statement.type}: ${statement.name} (from ${fileName})${deps}`;
	}

	#ensureTerminated(content: string): string {
		// already ends with `;`, possibly followed by trailing comments
		if (/;\s*(?:--[^\n]*\s*)*$/.test(content)) {
			return content;
		}
		return `${content};`;
	}

	#logMergeResults(statements: SqlStatement[], content: string): void {
		const uniqueFiles = new Set(statements.map((s) => s.filePath));

		this.#logger.header('📄 SQL Merge Complete', '-');
		this.#logger.info(`📁 Files processed: ${uniqueFiles.size}`);
		this.#logger.info(`📋 Statements merged: ${statements.length}`);
		this.#logger.info(`📝 Total lines: ${content.split('\n').length}`);
		this.#logger.info(`📊 Characters: ${content.length}`);

		this.#logger.success('Merge successful!');
		this.#logger.raw('');
	}
}

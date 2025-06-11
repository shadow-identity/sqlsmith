import { writeFileSync } from 'node:fs';
import type { SqlFile, SqlStatement } from '../types/sql-statement.js';
import type { Logger } from './logger.js';

export interface MergeOptions {
	addComments?: boolean;
	separateStatements?: boolean;
	includeHeader?: boolean;
	outputPath?: string;
}

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
			outputPath,
		} = options;

		if (statements.length === 0) {
			return '';
		}

		const parts: string[] = [];

		// Add header comment if requested
		if (includeHeader) {
			const timestamp = new Date().toISOString();
			const statementCount = statements.length;
			const uniqueFiles = new Set(
				statements.map((s) => s.filePath.split('/').pop()),
			).size;

			const header = `-- SQLsmith Output
-- Generated: ${timestamp}
-- Files processed: ${uniqueFiles}
-- Statements merged: ${statementCount}
-- Order: ${statements.map((s) => `${s.type}:${s.name}`).join(' → ')}
`;
			parts.push(header);
		}

		// Group statements by file to maintain file-level organization
		const statementsByFile = new Map<string, SqlStatement[]>();
		for (const statement of statements) {
			if (!statementsByFile.has(statement.filePath)) {
				statementsByFile.set(statement.filePath, []);
			}
			statementsByFile.get(statement.filePath)!.push(statement);
		}

		// Process each file's statements in topological order
		const processedFiles = new Set<string>();

		for (const statement of statements) {
			const filePath = statement.filePath;

			// Skip if we've already processed this file
			if (processedFiles.has(filePath)) {
				continue;
			}

			const fileName = filePath.split('/').pop() || 'unknown';
			const fileStatements = statementsByFile.get(filePath) || [];

			// Add file comment if requested
			if (addComments && fileStatements.length > 0) {
				const stmtDescriptions = fileStatements.map((stmt) => {
					const deps =
						stmt.dependsOn.length > 0
							? ` (depends on: ${stmt.dependsOn.map((d) => d.name).join(', ')})`
							: ' (no dependencies)';
					return `${stmt.type.toUpperCase()}: ${stmt.name}${deps}`;
				});

				const fileComment = `
-- ================================================================
-- File: ${fileName}
-- Statements: ${stmtDescriptions.join(', ')}
-- ================================================================`;
				parts.push(fileComment);
			}

			// Add file content
			// For now, we use the original file content since we haven't implemented
			// per-statement content extraction yet
			if (fileStatements.length > 0) {
				let content = fileStatements[0].content.trim();

				// Ensure content ends with semicolon if it doesn't already
				if (!content.endsWith(';')) {
					content += ';';
				}

				parts.push(content);
			}

			processedFiles.add(filePath);

			// Add separator between files if requested
			if (separateStatements && processedFiles.size < statementsByFile.size) {
				parts.push(''); // Empty line for separation
			}
		}

		const mergedContent = parts.join('\n');

		// Handle output
		if (outputPath) {
			// Write to file
			try {
				writeFileSync(outputPath, mergedContent, 'utf-8');
				this.#logger.info(`📁 Output written to: ${outputPath}`);
			} catch (error) {
				throw new Error(`Failed to write output file ${outputPath}: ${error}`);
			}
		} else {
			// Default to stdout when no output path is specified
			process.stdout.write(mergedContent);
			this.#logger.info('📤 Output written to stdout (default)');
		}

		this.#logMergeResults(statements, mergedContent, outputPath);

		return mergedContent;
	}

	/**
	 * Merge SQL files (legacy compatibility method)
	 */
	mergeFiles(files: SqlFile[], options: MergeOptions = {}): string {
		// Extract all statements and sort by their original order
		// This is a simplified approach - ideally statements would already be sorted
		const allStatements: SqlStatement[] = [];

		for (const file of files) {
			allStatements.push(...file.statements);
		}

		return this.mergeStatements(allStatements, options);
	}

	#logMergeResults(
		statements: SqlStatement[],
		content: string,
		outputPath?: string,
	): void {
		const uniqueFiles = new Set(statements.map((s) => s.filePath));

		this.#logger.header('📄 SQL Merge Complete', '-');
		this.#logger.info(`📁 Files processed: ${uniqueFiles.size}`);
		this.#logger.info(`📋 Statements merged: ${statements.length}`);
		this.#logger.info(`📝 Total lines: ${content.split('\n').length}`);
		this.#logger.info(`📊 Characters: ${content.length}`);

		if (outputPath) {
			this.#logger.info(`💾 Saved to: ${outputPath}`);
		} else {
			this.#logger.info(`📤 Output: stdout (default)`);
		}

		this.#logger.success('Merge successful!');
		this.#logger.raw('');
	}
}

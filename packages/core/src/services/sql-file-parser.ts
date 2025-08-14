import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import pkg from 'node-sql-parser';

import type { StatementProcessor } from '../processors/base-processor.js';
import type {
	ParseResult,
	SqlDialect,
	SqlFile,
	SqlStatement,
} from '../types/sql-statement.js';

const { Parser } = pkg;

export class SqlFileParser {
	#parser = new Parser();
	#processors: StatementProcessor[] = [];

	constructor(processors: StatementProcessor[] = []) {
		this.#processors = processors;
	}

	addProcessor(processor: StatementProcessor): void {
		this.#processors.push(processor);
	}

	/**
	 * Find all SQL files in a directory
	 */
	findSqlFiles(directoryPath: string): string[] {
		const sqlFiles: string[] = [];

		try {
			const entries = readdirSync(directoryPath);

			for (const entry of entries) {
				const fullPath = join(directoryPath, entry);
				const stats = statSync(fullPath);

				if (stats.isFile() && extname(entry).toLowerCase() === '.sql') {
					sqlFiles.push(fullPath);
				}
			}

			return sqlFiles.sort(); // Sort for consistent ordering
		} catch (error) {
			throw new Error(`Failed to scan directory ${directoryPath}: ${error}`);
		}
	}

	/**
	 * Parse a directory of SQL files
	 */
	parseDirectory(
		directoryPath: string,
		dialect: SqlDialect = 'postgresql',
	): SqlFile[] {
		const filePaths = this.findSqlFiles(directoryPath);
		const sqlFiles: SqlFile[] = [];

		for (const filePath of filePaths) {
			const sqlFile = this.parseFile(filePath, dialect);
			sqlFiles.push(sqlFile);
		}

		return sqlFiles;
	}

	/**
	 * Parse a single SQL file
	 */
	parseFile(filePath: string, dialect: SqlDialect = 'postgresql'): SqlFile {
		try {
			const content = readFileSync(filePath, 'utf-8').trim();

			if (!content) {
				return {
					path: filePath,
					content,
					statements: [],
				};
			}

			// Normalize SQL to avoid unsupported constructs in the underlying parser
			const normalized = this.#normalizeSqlForParser(content, dialect);

			const parseResult = this.parseContent(normalized, filePath, dialect);

			// Update statement content with the original file content
			// This is a simplified approach - in reality we'd need to track line ranges
			for (const statement of parseResult.statements) {
				statement.content = content; // For now, each statement gets the full file content
			}

			return {
				path: filePath,
				content,
				statements: parseResult.statements,
				ast: parseResult.ast,
			};
		} catch (error) {
			throw new Error(`Failed to parse file ${filePath}: ${error}`);
		}
	}

	/**
	 * Parse SQL content using registered processors
	 */
	parseContent(
		sql: string,
		filePath: string,
		dialect: SqlDialect = 'postgresql',
	): ParseResult {
		try {
			const opt = { database: dialect };
			const { ast } = this.#parser.parse(sql, opt);

			const statements: SqlStatement[] = [];

			// Try each processor on the AST
			for (const processor of this.#processors) {
				const processorStatements = processor.extractStatements(ast, filePath);
				statements.push(...processorStatements);
			}

			return { ast, statements };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to parse SQL content: ${message}`);
		}
	}

	/**
	 * Get all supported statement types from registered processors
	 */
	getSupportedTypes(): string[] {
		const types = new Set<string>();

		for (const processor of this.#processors) {
			for (const type of processor.getHandledTypes()) {
				types.add(type);
			}
		}

		return Array.from(types);
	}

	/**
	 * Normalize SQL content to increase compatibility with the underlying parser
	 * without affecting dependency analysis semantics.
	 *
	 * Currently handles:
	 * - PostgreSQL IDENTITY columns: `GENERATED ALWAYS/BY DEFAULT AS IDENTITY [(...)]`
	 *   These do not impact foreign-key dependencies, so they can be safely removed
	 *   prior to parsing.
	 *
	 * FIXME: Remove this workaround once node-sql-parser releases support for
	 * PostgreSQL IDENTITY columns (tracked upstream in
	 * https://github.com/taozhi8833998/node-sql-parser/issues/2518, milestone 5.3.12).
	 */
	#normalizeSqlForParser(sql: string, dialect: SqlDialect): string {
		let result = sql;

		if (dialect === 'postgresql') {
			// Remove IDENTITY column clauses which node-sql-parser may not support yet
			// e.g., "GENERATED ALWAYS AS IDENTITY", optionally with options in parentheses
			const identityRegex =
				/\bGENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY(\s*\([^)]*\))?/gi;
			result = result.replace(identityRegex, '').replace(/\s+,/g, ',');
		}

		return result;
	}
}

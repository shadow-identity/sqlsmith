import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { AST } from 'node-sql-parser';
import pkg from 'node-sql-parser';

import type { StatementProcessor } from '../processors/base-processor.js';
import type {
	SqlDialect,
	SqlFile,
	SqlStatement,
} from '../types/sql-statement.js';
import { splitSqlStatements } from './sql-statement-splitter.js';

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
	 * Parse a single SQL file.
	 *
	 * The file is split into per-statement chunks first; each chunk is
	 * normalized and parsed independently, so every statement carries its own
	 * original text (leading comments included). Chunks no processor
	 * recognizes become `raw` statements — they are carried through the merge
	 * verbatim, anchored to their file neighbours.
	 */
	parseFile(filePath: string, dialect: SqlDialect = 'postgresql'): SqlFile {
		const content = readFileSync(filePath, 'utf-8');

		if (!content.trim()) {
			return {
				path: filePath,
				content,
				statements: [],
			};
		}

		const chunks = splitSqlStatements(content, dialect);
		const statements: SqlStatement[] = [];
		const astNodes: AST[] = [];

		chunks.forEach((chunk, index) => {
			const normalized = this.#normalizeSqlForParser(chunk.text, dialect);

			let ast: AST | AST[];
			try {
				({ ast } = this.#parser.parse(normalized, { database: dialect }));
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(
					`Failed to parse file ${filePath}: statement starting at line ${chunk.startLine}: ${message}`,
				);
			}

			const nodes = Array.isArray(ast) ? ast : [ast];
			if (nodes.length !== 1) {
				throw new Error(
					`Failed to parse file ${filePath}: statement starting at line ${chunk.startLine} unexpectedly parsed into ${nodes.length} statements`,
				);
			}
			const node = nodes[0];
			astNodes.push(node);

			const statement =
				this.#extractRecognizedStatement(node, filePath) ??
				this.#buildRawStatement(node, filePath, index);

			statement.content = (chunk.leadingTrivia + chunk.text).trim();
			statement.orderInFile = index;
			statement.lineNumber = chunk.startLine;
			statements.push(statement);
		});

		return {
			path: filePath,
			content,
			statements,
			ast: astNodes,
		};
	}

	#extractRecognizedStatement(
		node: AST,
		filePath: string,
	): SqlStatement | undefined {
		for (const processor of this.#processors) {
			const extracted = processor.extractStatements(node, filePath);
			if (extracted.length > 0) {
				return extracted[0];
			}
		}
		return undefined;
	}

	#buildRawStatement(node: AST, filePath: string, index: number): SqlStatement {
		const fileName = filePath.split('/').pop() ?? filePath;
		return {
			type: 'raw',
			name: `${fileName}#${index + 1}`,
			dependsOn: [],
			filePath,
			content: '',
			ast: node,
		};
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

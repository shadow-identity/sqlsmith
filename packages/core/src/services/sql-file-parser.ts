import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { AST } from 'node-sql-parser';
import pkg from 'node-sql-parser';

import type { StatementProcessor } from '../processors/base-processor.js';
import {
	FileSystemError,
	ParsingError,
	ProcessingError,
	SqlMergerError,
} from '../types/errors.js';
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
			const directoryStats = statSync(directoryPath);
			if (!directoryStats.isDirectory()) {
				throw FileSystemError.notDirectory(directoryPath);
			}
			const entries = readdirSync(directoryPath);

			for (const entry of entries) {
				const fullPath = join(directoryPath, entry);
				const stats = statSync(fullPath);

				if (stats.isFile() && extname(entry).toLowerCase() === '.sql') {
					sqlFiles.push(fullPath);
				}
			}

			return sqlFiles.sort(); // Sort for consistent ordering
		} catch (error: unknown) {
			if (error instanceof SqlMergerError) throw error;
			if (this.#isNodeError(error) && error.code === 'ENOENT') {
				throw FileSystemError.directoryNotFound(directoryPath);
			}
			throw FileSystemError.directoryNotReadable(
				directoryPath,
				this.#toError(error),
			);
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
		let content: string;
		try {
			content = readFileSync(filePath, 'utf-8');
		} catch (error: unknown) {
			if (this.#isNodeError(error) && error.code === 'ENOENT') {
				throw FileSystemError.fileNotFound(filePath);
			}
			throw FileSystemError.fileReadFailed(filePath, this.#toError(error));
		}

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
				throw ParsingError.invalidSqlSyntax(
					filePath,
					chunk.startLine,
					this.#toError(error),
				);
			}

			const nodes = Array.isArray(ast) ? ast : [ast];
			if (nodes.length !== 1) {
				throw ParsingError.parsingFailed(
					filePath,
					chunk.startLine,
					new Error(
						`Expected one AST node but parsed ${nodes.length} statements`,
					),
				);
			}
			const node = nodes[0];
			astNodes.push(node);

			const statement =
				this.#extractRecognizedStatement(node, filePath, chunk.startLine) ??
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
		lineNumber: number,
	): SqlStatement | undefined {
		for (const processor of this.#processors) {
			let extracted: SqlStatement[];
			try {
				extracted = processor.extractStatements(node, filePath);
			} catch (error: unknown) {
				if (error instanceof SqlMergerError) throw error;
				throw ProcessingError.processorError(
					processor.constructor.name,
					this.#toError(error),
					{ filePath, lineNumber },
				);
			}
			if (extracted.length > 0) {
				return extracted[0];
			}
		}
		return undefined;
	}

	#isNodeError(error: unknown): error is NodeJS.ErrnoException {
		return error instanceof Error && 'code' in error;
	}

	#toError(error: unknown): Error {
		return error instanceof Error ? error : new Error(String(error));
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

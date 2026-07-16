import type { Dirent } from 'node:fs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { AST } from 'node-sql-parser';
import pkg from 'node-sql-parser';

import type {
	StatementProcessor,
	StatementProcessorContext,
} from '../processors/base-processor.js';
import {
	FileSystemError,
	ParsingError,
	ProcessingError,
	SqlMergerError,
} from '../types/errors.js';
import type { DiscoveryOptions } from '../types/merge-plan.js';
import { createIdentifierRules } from '../types/relation-identifier.js';
import type {
	SqlDialect,
	SqlFile,
	SqlStatement,
} from '../types/sql-statement.js';
import { scanCteAliases, scanRelationNames } from './sql-identifier-lexer.js';
import { splitSqlStatements } from './sql-statement-splitter.js';

const { Parser } = pkg;

export interface SqlFileParserOptions {
	readonly defaultSchema?: string;
}

export class SqlFileParser {
	#parser = new Parser();
	#processors: StatementProcessor[] = [];
	#defaultSchema?: string;

	constructor(
		processors: StatementProcessor[] = [],
		options: SqlFileParserOptions = {},
	) {
		this.#processors = processors;
		this.#defaultSchema = options.defaultSchema;
	}

	addProcessor(processor: StatementProcessor): void {
		this.#processors.push(processor);
	}

	/**
	 * Find all SQL files in a directory
	 */
	findSqlFiles(
		directoryPath: string,
		discovery: DiscoveryOptions = {},
	): string[] {
		const sqlFiles: string[] = [];
		const root = resolve(directoryPath);
		const excluded = (discovery.exclude ?? []).map((path) => resolve(path));
		const isExcluded = (candidate: string): boolean =>
			excluded.some((excludedPath) => {
				const pathFromExcluded = relative(excludedPath, candidate);
				return (
					pathFromExcluded === '' ||
					(!pathFromExcluded.startsWith('..') && !isAbsolute(pathFromExcluded))
				);
			});
		const scan = (currentDirectory: string): void => {
			let entries: Dirent[];
			try {
				entries = readdirSync(currentDirectory, { withFileTypes: true });
			} catch (error: unknown) {
				throw FileSystemError.directoryNotReadable(
					currentDirectory,
					this.#toError(error),
				);
			}

			for (const entry of entries.sort((left, right) =>
				left.name.localeCompare(right.name),
			)) {
				const fullPath = join(currentDirectory, entry.name);
				if (isExcluded(fullPath)) continue;
				if (entry.isDirectory()) {
					if (discovery.recursive) scan(fullPath);
					continue;
				}
				if (entry.isFile() && extname(entry.name).toLowerCase() === '.sql') {
					sqlFiles.push(fullPath);
				}
			}
		};

		try {
			const directoryStats = statSync(root);
			if (!directoryStats.isDirectory()) {
				throw FileSystemError.notDirectory(root);
			}
			scan(root);
			return sqlFiles;
		} catch (error: unknown) {
			if (error instanceof SqlMergerError) throw error;
			if (this.#isNodeError(error) && error.code === 'ENOENT') {
				throw FileSystemError.directoryNotFound(root);
			}
			throw FileSystemError.directoryNotReadable(root, this.#toError(error));
		}
	}

	/**
	 * Parse a directory of SQL files
	 */
	parseDirectory(
		directoryPath: string,
		dialect: SqlDialect = 'postgresql',
		discovery: DiscoveryOptions = {},
	): SqlFile[] {
		const filePaths = this.findSqlFiles(directoryPath, discovery);
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
			const source = chunk.leadingTrivia + chunk.text;
			const processorContext: StatementProcessorContext = {
				source,
				dialect,
				identifierRules: createIdentifierRules(dialect, this.#defaultSchema),
				relationNames: scanRelationNames(source),
				cteAliases: scanCteAliases(source),
			};

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
				this.#extractRecognizedStatement(
					node,
					filePath,
					chunk.startLine,
					processorContext,
				) ?? this.#buildRawStatement(node, filePath, index);

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
		context: StatementProcessorContext,
	): SqlStatement | undefined {
		for (const processor of this.#processors) {
			let extracted: SqlStatement[];
			try {
				extracted = processor.extractStatements(node, filePath, context);
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

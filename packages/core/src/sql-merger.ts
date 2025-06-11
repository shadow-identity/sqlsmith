import pkg from 'node-sql-parser';

const { Parser } = pkg;

import type { DependencyAnalyzer } from './services/dependency-analyzer.js';
import type { ErrorHandler } from './services/error-handler.js';
import type { Logger } from './services/logger.js';
import type { ServiceConfiguration } from './services/service-container.js';
import { ServiceContainer } from './services/service-container.js';
import type {
	MergeOptions,
	SqlFileMerger,
} from './services/sql-file-merger.js';
import type { SqlFileParser } from './services/sql-file-parser.js';
import type { TopologicalSorter } from './services/topological-sorter.js';
import { DependencyError, FileSystemError } from './types/errors.js';
import type {
	SqlDialect,
	SqlFile,
	SqlStatement,
} from './types/sql-statement.js';

// Legacy interface for backward compatibility
export interface SqlMergerOptions {
	allowReorderDropComments?: boolean;
	enableViews?: boolean;
	enableSequences?: boolean;
	logger?: Logger;
}

export class SqlMerger {
	#container: ServiceContainer;
	#fileParser: SqlFileParser;
	#dependencyAnalyzer: DependencyAnalyzer;
	#topologicalSorter: TopologicalSorter;
	#fileMerger: SqlFileMerger;
	#logger: Logger;
	#errorHandler: ErrorHandler;

	constructor(options: SqlMergerOptions = {}, container?: ServiceContainer) {
		if (container) {
			// Use provided container
			this.#container = container;
		} else {
			// Convert legacy options to service configuration
			const serviceConfig: ServiceConfiguration = {
				allowReorderDropComments: options.allowReorderDropComments ?? false,
				enableViews: options.enableViews ?? true,
				enableSequences: options.enableSequences ?? true,
				loggerOptions: {},
			};

			this.#container = new ServiceContainer(serviceConfig);
		}

		// Initialize services through dependency injection
		this.#logger = options.logger ?? this.#container.getLogger();
		this.#errorHandler = this.#container.getErrorHandler();
		this.#dependencyAnalyzer = this.#container.getDependencyAnalyzer();
		this.#topologicalSorter = this.#container.getTopologicalSorter();
		this.#fileMerger = this.#container.getSqlFileMerger();
		this.#fileParser = this.#container.getSqlFileParser();
	}

	/**
	 * Create SqlMerger with service container (preferred way)
	 */
	static withContainer(container: ServiceContainer): SqlMerger {
		// Create instance using constructor with the provided container
		return new SqlMerger({}, container);
	}

	/**
	 * Parse SQL files from a directory
	 */
	parseSqlFiles(
		directoryPath: string,
		dialect: SqlDialect = 'postgresql',
		options: SqlMergerOptions = {},
	): SqlFile[] {
		return this.#errorHandler.wrapWithErrorHandling(() => {
			this.#logger.info(`🔍 Parsing SQL files from: ${directoryPath}`);
			this.#logger.info(`🗃️  Dialect: ${dialect}`);
			this.#logger.info(
				`⚙️  Processors: ${this.#fileParser.getSupportedTypes().join(', ')}`,
			);

			const sqlFiles = this.#fileParser.parseDirectory(directoryPath, dialect);

			if (sqlFiles.length === 0) {
				throw FileSystemError.noSqlFiles(directoryPath);
			}

			const allStatements: SqlStatement[] = [];
			for (const file of sqlFiles) {
				allStatements.push(...file.statements);
			}

			this.#logger.success(
				`Successfully processed ${sqlFiles.length} SQL files`,
			);
			this.#logger.info(`📋 Found ${allStatements.length} statements:`);

			const statementCounts = new Map<string, number>();
			for (const stmt of allStatements) {
				statementCounts.set(
					stmt.type,
					(statementCounts.get(stmt.type) || 0) + 1,
				);
			}

			for (const [type, count] of statementCounts) {
				this.#logger.info(
					`  - ${count} ${type.toUpperCase()} statement${count > 1 ? 's' : ''}`,
				);
			}

			this.#dependencyAnalyzer.validateNoDuplicateNames(allStatements);

			this.#logger.info('\n🔧 Building dependency graph...');
			const graph = this.#dependencyAnalyzer.buildStatementGraph(allStatements);

			const config = this.#container.getConfiguration();
			if (!config.allowReorderDropComments) {
				this.#validateStatementOrderWithinFiles(sqlFiles);
			}

			const cycles = this.#dependencyAnalyzer.detectCycles(graph);
			if (cycles.length > 0) {
				throw DependencyError.circularDependency(cycles);
			}

			this.#dependencyAnalyzer.visualizeDependencyGraph(
				graph,
				allStatements,
				cycles,
			);

			return sqlFiles;
		}, 'parseSqlFiles')();
	}

	/**
	 * Parse a single SQL file
	 */
	parseSingleFile(
		filePath: string,
		dialect: SqlDialect = 'postgresql',
		options: SqlMergerOptions = {},
	): SqlFile {
		return this.#errorHandler.wrapWithErrorHandling(() => {
			return this.#fileParser.parseFile(filePath, dialect);
		}, 'parseSingleFile')();
	}

	/**
	 * Merge SQL files with automatic dependency resolution
	 */
	mergeFiles(files: SqlFile[], options: MergeOptions = {}): string {
		return this.#errorHandler.wrapWithErrorHandling(() => {
			if (files.length === 0) {
				return '';
			}

			const allStatements: SqlStatement[] = [];
			for (const file of files) {
				allStatements.push(...file.statements);
			}

			const graph = this.#dependencyAnalyzer.buildStatementGraph(allStatements);
			const sortedStatements = this.#topologicalSorter.sortStatements(
				allStatements,
				graph,
			);

			return this.#fileMerger.mergeStatements(sortedStatements, options);
		}, 'mergeFiles')();
	}

	/**
	 * Analyze dependencies without merging (info command)
	 */
	analyzeDependencies(
		directoryPath: string,
		dialect: SqlDialect = 'postgresql',
	): void {
		this.#errorHandler.wrapWithErrorHandling(() => {
			this.#logger.header('🔍 SQL Dependency Analyzer');

			const sqlFiles = this.parseSqlFiles(directoryPath, dialect);

			const allStatements: SqlStatement[] = [];
			for (const file of sqlFiles) {
				allStatements.push(...file.statements);
			}

			const graph = this.#dependencyAnalyzer.buildStatementGraph(allStatements);
			const sortedStatements = this.#topologicalSorter.sortStatements(
				allStatements,
				graph,
			);

			this.#logger.info('📋 Recommended execution order:');
			sortedStatements.forEach((stmt, index) => {
				const fileName = stmt.filePath.split('/').pop();
				const deps =
					stmt.dependsOn.length > 0
						? ` (depends on: ${stmt.dependsOn.map((d) => d.name).join(', ')})`
						: ' (no dependencies)';
				this.#logger.info(
					`  ${index + 1}. ${fileName} - ${stmt.type}:${stmt.name}${deps}`,
				);
			});
		}, 'analyzeDependencies')();
	}

	/**
	 * Validate files without merging (validate command)
	 */
	validateFiles(
		directoryPath: string,
		dialect: SqlDialect = 'postgresql',
	): void {
		this.#errorHandler.wrapWithErrorHandling(() => {
			this.#logger.header('✅ SQL Validator');

			const sqlFiles = this.parseSqlFiles(directoryPath, dialect);

			const allStatements: SqlStatement[] = [];
			for (const file of sqlFiles) {
				allStatements.push(...file.statements);
			}

			for (const file of sqlFiles) {
				const fileName = file.path.split('/').pop() || file.path;
				if (file.statements.length === 0) {
					this.#logger.warn(`${fileName} - no statements found`);
				} else {
					const stmtDescriptions = file.statements
						.map((s) => `${s.type}:${s.name}`)
						.join(', ');
					this.#logger.success(`${fileName} - ${stmtDescriptions}`);
				}
			}

			this.#logger.info(
				`\n📊 Total: ${sqlFiles.length} files, ${allStatements.length} statements`,
			);

			this.#logger.success('No circular dependencies detected');
			this.#logger.success('Ready for merging');
		}, 'validateFiles')();
	}

	/**
	 * Get supported statement types
	 */
	getSupportedTypes(): string[] {
		return this.#fileParser.getSupportedTypes();
	}

	/**
	 * Get service container (for advanced usage)
	 */
	getContainer(): ServiceContainer {
		return this.#container;
	}

	/**
	 * Validate statement order within files
	 */
	#validateStatementOrderWithinFiles = (sqlFiles: SqlFile[]): void => {
		for (const file of sqlFiles) {
			const statements = file.statements;
			if (statements.length <= 1) continue;

			for (let i = 0; i < statements.length; i++) {
				const current = statements[i];

				for (const dependency of current.dependsOn) {
					const depStatement = statements.find(
						(s) => s.name === dependency.name,
					);
					if (depStatement) {
						const depIndex = statements.indexOf(depStatement);
						if (depIndex > i) {
							throw DependencyError.invalidStatementOrder(
								file.path,
								`Statement '${current.name}' at position ${i} depends on '${dependency.name}' which appears later in the file at position ${depIndex}`,
							);
						}
					}
				}
			}
		}
	};
}

// Re-export types for external use
export type { SqlFile, SqlStatement, SqlDialect, MergeOptions };
export type { Dependency, StatementType } from './types/sql-statement.js';

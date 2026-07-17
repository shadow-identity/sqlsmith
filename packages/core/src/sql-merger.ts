import { AlterTableProcessor } from './processors/alter-table-processor.js';
import type { StatementProcessor } from './processors/base-processor.js';
import { CreateIndexProcessor } from './processors/create-index-processor.js';
import { CreateSequenceProcessor } from './processors/create-sequence-processor.js';
import { CreateTableProcessor } from './processors/create-table-processor.js';
import { CreateViewProcessor } from './processors/create-view-processor.js';
import { DependencyAnalyzer } from './services/dependency-analyzer.js';
import { Logger } from './services/logger.js';
import {
	type MergeOptions,
	SqlFileMerger,
} from './services/sql-file-merger.js';
import { SqlFileParser } from './services/sql-file-parser.js';
import { TopologicalSorter } from './services/topological-sorter.js';
import { DependencyError, FileSystemError } from './types/errors.js';
import type {
	DependencyAnalysis,
	DiscoveryOptions,
	MergeDiagnostic,
	MergePlan,
} from './types/merge-plan.js';
import type {
	SqlDialect,
	SqlFile,
	SqlStatement,
} from './types/sql-statement.js';

export interface SqlMergerOptions {
	/** Require dependencies to precede dependents within each file. */
	validateSourceOrder?: boolean;
	/** Convert unknown references into diagnostics instead of errors. */
	allowExternalReferences?: boolean;
	/** Schema assigned to unqualified relation names (`public` for PostgreSQL). */
	defaultSchema?: string;
	enableViews?: boolean;
	enableSequences?: boolean;
	/** Recognize CREATE INDEX statements and order them after their table. */
	enableIndexes?: boolean;
	/** Recognize ALTER TABLE statements and order them after every referenced table. */
	enableAlters?: boolean;
	/** Additional statement processors appended to the built-in processors. */
	processors?: readonly StatementProcessor[];
	/** Optional application logger; core only emits explicitly requested debug. */
	logger?: Logger;
}

export interface SqlFileParserDependency {
	parseDirectory(
		directoryPath: string,
		dialect?: SqlDialect,
		options?: DiscoveryOptions,
	): SqlFile[];
	parseFile(filePath: string, dialect?: SqlDialect): SqlFile;
	getSupportedTypes(): string[];
}

export interface DependencyAnalyzerDependency {
	buildStatementGraph(statements: SqlStatement[]): DependencyAnalysis;
	validateNoDuplicateNames(statements: SqlStatement[]): void;
}

export interface TopologicalSorterDependency {
	sortStatements(
		statements: SqlStatement[],
		graph: MergePlan['graph'],
	): SqlStatement[];
}

export interface SqlEmitterDependency {
	mergeStatements(statements: SqlStatement[], options?: MergeOptions): string;
}

export interface SqlMergerDependencies {
	fileParser?: SqlFileParserDependency;
	dependencyAnalyzer?: DependencyAnalyzerDependency;
	topologicalSorter?: TopologicalSorterDependency;
	fileMerger?: SqlEmitterDependency;
}

export class SqlMerger {
	#fileParser: SqlFileParserDependency;
	#dependencyAnalyzer: DependencyAnalyzerDependency;
	#topologicalSorter: TopologicalSorterDependency;
	#fileMerger: SqlEmitterDependency;
	#logger: Logger;
	#validateSourceOrder: boolean;

	constructor(
		options: SqlMergerOptions = {},
		dependencies: SqlMergerDependencies = {},
	) {
		this.#logger = options.logger ?? new Logger();
		this.#validateSourceOrder = options.validateSourceOrder ?? true;

		const processors: StatementProcessor[] = [new CreateTableProcessor()];
		if (options.enableViews ?? true) processors.push(new CreateViewProcessor());
		if (options.enableSequences ?? true) {
			processors.push(new CreateSequenceProcessor());
		}
		if (options.enableIndexes ?? true) {
			processors.push(new CreateIndexProcessor());
		}
		if (options.enableAlters ?? true) {
			processors.push(new AlterTableProcessor());
		}
		processors.push(...(options.processors ?? []));

		this.#fileParser =
			dependencies.fileParser ??
			new SqlFileParser(processors, { defaultSchema: options.defaultSchema });
		this.#dependencyAnalyzer =
			dependencies.dependencyAnalyzer ??
			new DependencyAnalyzer({
				allowExternalReferences: options.allowExternalReferences ?? false,
			});
		this.#topologicalSorter =
			dependencies.topologicalSorter ?? new TopologicalSorter();
		this.#fileMerger = dependencies.fileMerger ?? new SqlFileMerger();
	}

	/** Discover, parse, validate and order a directory as one immutable value. */
	planDirectory(
		directoryPath: string,
		dialect: SqlDialect = 'postgresql',
		discovery: DiscoveryOptions = {},
	): MergePlan {
		this.#logger.debug(`Planning SQL directory: ${directoryPath}`);
		const files = this.#fileParser.parseDirectory(
			directoryPath,
			dialect,
			discovery,
		);
		if (files.length === 0) throw FileSystemError.noSqlFiles(directoryPath);
		return this.planFiles(files);
	}

	/** Validate and order already parsed files without rebuilding during merge. */
	planFiles(files: readonly SqlFile[]): MergePlan {
		const mutableFiles = [...files];
		const allStatements = mutableFiles.flatMap((file) => file.statements);
		const statements = allStatements.filter(
			(statement) => statement.type !== 'raw',
		);
		const rawStatements = allStatements.filter(
			(statement) => statement.type === 'raw',
		);

		this.#dependencyAnalyzer.validateNoDuplicateNames(statements);
		if (this.#validateSourceOrder) {
			this.#validateStatementOrderWithinFiles(mutableFiles);
		}

		const analysis = this.#dependencyAnalyzer.buildStatementGraph(statements);
		const sorted = this.#topologicalSorter.sortStatements(
			statements,
			analysis.graph,
		);
		const woven = this.#weaveRawStatements(sorted, allStatements);
		const diagnostics: MergeDiagnostic[] = [...analysis.diagnostics];

		if (rawStatements.length > 0) {
			diagnostics.push({
				code: 'RAW_STATEMENTS',
				severity: 'info',
				message: `${rawStatements.length} unrecognized statement(s) are carried through verbatim`,
				count: rawStatements.length,
				statements: rawStatements.map((statement) => statement.name),
			});
			diagnostics.push(
				...this.#collectCrossFileRawReferences(rawStatements, statements),
			);
		}
		if (woven.tail.length > 0) {
			diagnostics.push({
				code: 'RAW_ONLY_FILE',
				severity: 'warning',
				message: `${woven.tail.length} statement(s) from files with no recognized statements are appended at the end of the output`,
				count: woven.tail.length,
				statements: woven.tail.map((statement) => statement.name),
			});
		}

		return {
			files: mutableFiles,
			statements,
			graph: analysis.graph,
			orderedStatements: woven.statements,
			diagnostics,
		};
	}

	/** Pure emission: this method never parses, validates, or rebuilds a graph. */
	merge(plan: MergePlan, options: MergeOptions = {}): string {
		return this.#fileMerger.mergeStatements(
			[...plan.orderedStatements],
			options,
		);
	}

	parseSingleFile(
		filePath: string,
		dialect: SqlDialect = 'postgresql',
	): SqlFile {
		return this.#fileParser.parseFile(filePath, dialect);
	}

	getSupportedTypes(): string[] {
		return this.#fileParser.getSupportedTypes();
	}

	/**
	 * Raw statements are woven next to same-file neighbours, so their order
	 * relative to relations defined in other files is not guaranteed — that is
	 * the one genuinely risky raw case, and the one that warrants a warning.
	 */
	#collectCrossFileRawReferences(
		rawStatements: readonly SqlStatement[],
		recognized: readonly SqlStatement[],
	): MergeDiagnostic[] {
		const definedIn = new Map<string, string>();
		for (const statement of recognized) {
			if (statement.identifier) {
				definedIn.set(statement.identifier.key, statement.filePath);
			}
		}

		const diagnostics: MergeDiagnostic[] = [];
		for (const raw of rawStatements) {
			const reported = new Set<string>();
			for (const reference of raw.referencedRelations ?? []) {
				const definitionFilePath = definedIn.get(reference.key);
				if (
					definitionFilePath === undefined ||
					definitionFilePath === raw.filePath ||
					reported.has(reference.key)
				) {
					continue;
				}
				reported.add(reference.key);
				const definitionFileName =
					definitionFilePath.split('/').pop() ?? definitionFilePath;
				diagnostics.push({
					code: 'RAW_CROSS_FILE_REFERENCE',
					severity: 'warning',
					message: `Raw statement '${raw.name}' references '${reference.display}' defined in ${definitionFileName}; its order relative to that definition is not guaranteed`,
					statementName: raw.name,
					dependencyName: reference.display,
					dependencyKey: reference.key,
					filePath: raw.filePath,
					definitionFilePath,
				});
			}
		}
		return diagnostics;
	}

	#weaveRawStatements(
		sorted: SqlStatement[],
		all: SqlStatement[],
	): { statements: SqlStatement[]; tail: SqlStatement[] } {
		const rawStatements = all.filter((statement) => statement.type === 'raw');
		if (rawStatements.length === 0) return { statements: sorted, tail: [] };

		const recognizedByFile = new Map<string, SqlStatement[]>();
		for (const statement of all) {
			if (statement.type === 'raw') continue;
			const list = recognizedByFile.get(statement.filePath) ?? [];
			list.push(statement);
			recognizedByFile.set(statement.filePath, list);
		}
		for (const list of recognizedByFile.values()) {
			list.sort(
				(left, right) => (left.orderInFile ?? 0) - (right.orderInFile ?? 0),
			);
		}

		const emitAfter = new Map<SqlStatement, SqlStatement[]>();
		const emitBefore = new Map<SqlStatement, SqlStatement[]>();
		const tail: SqlStatement[] = [];

		for (const raw of rawStatements) {
			const neighbours = recognizedByFile.get(raw.filePath) ?? [];
			const rawOrder = raw.orderInFile ?? 0;
			const anchorAfter = [...neighbours]
				.reverse()
				.find((statement) => (statement.orderInFile ?? 0) < rawOrder);
			if (anchorAfter) {
				const list = emitAfter.get(anchorAfter) ?? [];
				list.push(raw);
				emitAfter.set(anchorAfter, list);
				continue;
			}

			const anchorBefore = neighbours.find(
				(statement) => (statement.orderInFile ?? 0) > rawOrder,
			);
			if (anchorBefore) {
				const list = emitBefore.get(anchorBefore) ?? [];
				list.push(raw);
				emitBefore.set(anchorBefore, list);
				continue;
			}
			tail.push(raw);
		}

		const result: SqlStatement[] = [];
		for (const statement of sorted) {
			result.push(...(emitBefore.get(statement) ?? []));
			result.push(statement);
			result.push(...(emitAfter.get(statement) ?? []));
		}
		result.push(...tail);
		return { statements: result, tail };
	}

	#validateStatementOrderWithinFiles(files: readonly SqlFile[]): void {
		for (const file of files) {
			for (let index = 0; index < file.statements.length; index++) {
				const statement = file.statements[index];
				for (const dependency of statement.dependsOn) {
					const dependencyIndex = file.statements.findIndex(
						(candidate) =>
							candidate.identifier?.key === dependency.identifier.key,
					);
					if (dependencyIndex > index) {
						const statementDisplay =
							statement.identifier?.display ?? statement.name;
						throw DependencyError.invalidStatementOrder(
							file.path,
							`Statement '${statementDisplay}' at position ${index} depends on '${dependency.identifier.display}' which appears later in the file at position ${dependencyIndex}`,
							{
								statementKey: statement.identifier?.key,
								dependencyKey: dependency.identifier.key,
							},
						);
					}
				}
			}
		}
	}
}

export type { SqlDialect } from './types/dialect.js';
export type {
	DialectRules,
	IdentifierPart,
	RelationIdentifier,
	RelationKey,
} from './types/relation-identifier.js';
export type {
	Dependency,
	SqlFile,
	SqlStatement,
	StatementType,
} from './types/sql-statement.js';
export type { DiscoveryOptions, MergeDiagnostic, MergeOptions, MergePlan };

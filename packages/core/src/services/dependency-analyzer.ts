import type { DependencyGraph } from '../types/dependency-graph.js';
import { DependencyError } from '../types/errors.js';
import type {
	DependencyAnalysis,
	MergeDiagnostic,
} from '../types/merge-plan.js';
import type { SqlStatement } from '../types/sql-statement.js';

export interface DependencyAnalyzerOptions {
	/**
	 * When true, dependencies on names not defined in the input set become
	 * structured diagnostics instead of errors.
	 */
	allowExternalReferences?: boolean;
}

export class DependencyAnalyzer {
	#allowExternalReferences: boolean;

	constructor(options: DependencyAnalyzerOptions = {}) {
		this.#allowExternalReferences = options.allowExternalReferences ?? false;
	}

	/** Build the one dependency graph owned by a MergePlan. */
	buildStatementGraph(statements: SqlStatement[]): DependencyAnalysis {
		const graph: DependencyGraph<string> = {
			nodes: new Set(),
			edges: new Map(),
			reversedEdges: new Map(),
		};
		const diagnostics: MergeDiagnostic[] = [];
		const recognized = statements.filter(
			(statement) => statement.type !== 'raw',
		);
		const statementMap = new Map(
			recognized.map((statement) => [statement.name, statement]),
		);

		for (const statement of recognized) {
			graph.nodes.add(statement.name);
			graph.edges.set(statement.name, new Set());
			graph.reversedEdges.set(statement.name, new Set());
		}

		for (const statement of recognized) {
			for (const dependency of statement.dependsOn) {
				const dependencyName = dependency.name;
				if (!statementMap.has(dependencyName)) {
					if (!this.#allowExternalReferences) {
						throw DependencyError.missingDependency(
							statement.name,
							dependencyName,
						);
					}
					diagnostics.push({
						code: 'EXTERNAL_REFERENCE',
						message: `External reference: '${statement.name}' depends on '${dependencyName}' which is not defined in the input files`,
						statementName: statement.name,
						dependencyName,
					});
					continue;
				}

				graph.edges.get(statement.name)?.add(dependencyName);
				graph.reversedEdges.get(dependencyName)?.add(statement.name);
			}
		}

		return { graph, diagnostics };
	}

	/** Validate names before graph construction so every graph node is unique. */
	validateNoDuplicateNames(statements: SqlStatement[]): void {
		const nameToFile = new Map<string, string>();
		const duplicates: Array<{ name: string; files: string[] }> = [];

		for (const statement of statements) {
			if (statement.type === 'raw') continue;
			const fileName =
				statement.filePath.split('/').pop() || statement.filePath;
			const existingFile = nameToFile.get(statement.name);
			if (!existingFile) {
				nameToFile.set(statement.name, fileName);
				continue;
			}

			const existing = duplicates.find(
				(duplicate) => duplicate.name === statement.name,
			);
			if (existing) {
				if (!existing.files.includes(fileName)) existing.files.push(fileName);
			} else {
				duplicates.push({
					name: statement.name,
					files: [existingFile, fileName],
				});
			}
		}

		if (duplicates.length > 0) {
			throw DependencyError.duplicateStatementNames(duplicates);
		}
	}
}

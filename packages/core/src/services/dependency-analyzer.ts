import type { DependencyGraph } from '../types/dependency-graph.js';
import { DependencyError, ProcessingError } from '../types/errors.js';
import type {
	DependencyAnalysis,
	MergeDiagnostic,
} from '../types/merge-plan.js';
import type {
	RelationIdentifier,
	RelationKey,
} from '../types/relation-identifier.js';
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
		const graph: DependencyGraph<RelationKey> = {
			nodes: new Set(),
			edges: new Map(),
			reversedEdges: new Map(),
		};
		const diagnostics: MergeDiagnostic[] = [];
		const recognized = statements.filter(
			(statement) => statement.type !== 'raw',
		);
		const statementMap = new Map(
			recognized.map((statement) => [
				this.#identifier(statement).key,
				statement,
			]),
		);

		for (const statement of recognized) {
			const key = this.#identifier(statement).key;
			graph.nodes.add(key);
			graph.edges.set(key, new Set());
			graph.reversedEdges.set(key, new Set());
		}

		for (const statement of recognized) {
			const statementIdentifier = this.#identifier(statement);
			for (const dependency of statement.dependsOn) {
				const dependencyIdentifier = dependency.identifier;
				if (!statementMap.has(dependencyIdentifier.key)) {
					if (!this.#allowExternalReferences) {
						throw DependencyError.missingDependency(
							statementIdentifier.display,
							dependencyIdentifier.display,
							statementIdentifier.key,
							dependencyIdentifier.key,
						);
					}
					diagnostics.push({
						code: 'EXTERNAL_REFERENCE',
						severity: 'warning',
						message: `External reference: '${statementIdentifier.display}' depends on '${dependencyIdentifier.display}' which is not defined in the input files`,
						statementName: statementIdentifier.display,
						statementKey: statementIdentifier.key,
						dependencyName: dependencyIdentifier.display,
						dependencyKey: dependencyIdentifier.key,
					});
					continue;
				}

				graph.edges.get(statementIdentifier.key)?.add(dependencyIdentifier.key);
				graph.reversedEdges
					.get(dependencyIdentifier.key)
					?.add(statementIdentifier.key);
			}
		}

		return { graph, diagnostics };
	}

	/** Validate names before graph construction so every graph node is unique. */
	validateNoDuplicateNames(statements: SqlStatement[]): void {
		const groups = new Map<
			RelationKey,
			{ name: string; key: RelationKey; files: string[]; count: number }
		>();

		for (const statement of statements) {
			if (statement.type === 'raw') continue;
			const identifier = this.#identifier(statement);
			const fileName =
				statement.filePath.split('/').pop() || statement.filePath;
			const group = groups.get(identifier.key);
			if (!group) {
				groups.set(identifier.key, {
					name: identifier.display,
					key: identifier.key,
					files: [fileName],
					count: 1,
				});
				continue;
			}
			group.count++;
			if (!group.files.includes(fileName)) group.files.push(fileName);
		}

		const duplicates = [...groups.values()]
			.filter(({ count }) => count > 1)
			.map(({ name, key, files }) => ({ name, key, files }));
		if (duplicates.length > 0) {
			throw DependencyError.duplicateStatementNames(duplicates);
		}
	}

	#identifier(statement: SqlStatement): RelationIdentifier {
		if (statement.identifier) return statement.identifier;
		throw ProcessingError.internalError(
			`Recognized statement '${statement.name}' has no relation identifier`,
		);
	}
}

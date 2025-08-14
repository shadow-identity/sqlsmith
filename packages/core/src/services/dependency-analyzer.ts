import type { DependencyGraph } from '../types/dependency-graph.js';
import { DependencyError } from '../types/errors.js';
import type { SqlFile, SqlStatement } from '../types/sql-statement.js';
import type { Logger } from './logger.js';

export class DependencyAnalyzer {
	#logger: Logger;

	constructor(logger: Logger) {
		this.#logger = logger;
	}

	/**
	 * Build a dependency graph from SQL statements
	 */
	buildStatementGraph(statements: SqlStatement[]): DependencyGraph<string> {
		const graph: DependencyGraph<string> = {
			nodes: new Set(),
			edges: new Map(),
			reversedEdges: new Map(),
		};

		const statementMap = new Map<string, SqlStatement>();
		for (const stmt of statements) {
			statementMap.set(stmt.name, stmt);
		}

		for (const statement of statements) {
			graph.nodes.add(statement.name);

			if (!graph.edges.has(statement.name)) {
				graph.edges.set(statement.name, new Set());
			}
			if (!graph.reversedEdges.has(statement.name)) {
				graph.reversedEdges.set(statement.name, new Set());
			}

			for (const dependency of statement.dependsOn) {
				const depName = dependency.name;
				graph.nodes.add(depName);

				graph.edges.get(statement.name)?.add(depName);

				if (!graph.reversedEdges.has(depName)) {
					graph.reversedEdges.set(depName, new Set());
				}
				graph.reversedEdges.get(depName)?.add(statement.name);
			}
		}

		return graph;
	}

	/**
	 * Build dependency graph from SQL files (legacy compatibility)
	 */
	buildFileGraph(sqlFiles: SqlFile[]): DependencyGraph<string> {
		const allStatements: SqlStatement[] = [];

		for (const file of sqlFiles) {
			allStatements.push(...file.statements);
		}

		return this.buildStatementGraph(allStatements);
	}

	/**
	 * Detect circular dependencies using DFS
	 * Self-referencing items (hierarchical structures) are not considered circular dependencies
	 */
	detectCycles(graph: DependencyGraph<string>): string[][] {
		const visited = new Set<string>();
		const recursionStack = new Set<string>();
		const cycles: string[][] = [];

		const dfs = (node: string, path: string[]): boolean => {
			if (recursionStack.has(node)) {
				const cycleStart = path.indexOf(node);
				const cycle = path.slice(cycleStart).concat([node]);

				// Self-references (hierarchical structures) are not circular dependencies
				if (cycle.length === 2 && cycle[0] === cycle[1]) {
					return false;
				}

				cycles.push(cycle);
				return true;
			}

			if (visited.has(node)) {
				return false;
			}

			visited.add(node);
			recursionStack.add(node);

			const dependencies = graph.edges.get(node) || new Set();
			for (const dep of dependencies) {
				if (dfs(dep, [...path, node])) {
					// Continue to find all cycles, don't short-circuit
				}
			}

			recursionStack.delete(node);
			return false;
		};

		for (const node of graph.nodes) {
			if (!visited.has(node)) {
				dfs(node, []);
			}
		}

		return cycles;
	}

	/**
	 * Visualize dependency graph for debugging
	 */
	visualizeDependencyGraph(
		graph: DependencyGraph<string>,
		statements: SqlStatement[] = [],
		cycles: string[][] = [],
	): void {
		const statementMap = new Map<string, SqlStatement>();
		for (const stmt of statements) {
			statementMap.set(stmt.name, stmt);
		}

		this.#logger.header('🔗 Dependency Graph');

		for (const node of graph.nodes) {
			const statement = statementMap.get(node);
			const type = statement?.type || 'unknown';
			const dependencies = graph.edges.get(node) || new Set();
			const dependents = graph.reversedEdges.get(node) || new Set();

			this.#logger.info(`📊 ${type.toUpperCase()}: ${node}`);

			if (dependencies.size > 0) {
				const nonSelfDeps = Array.from(dependencies).filter(
					(dep) => dep !== node,
				);
				if (nonSelfDeps.length > 0) {
					this.#logger.info(`  ➡️  Depends on: ${nonSelfDeps.join(', ')}`);
				}

				// Check for self-reference
				if (dependencies.has(node)) {
					this.#logger.info(
						`  🔄 Self-referencing: ${node} (hierarchical structure)`,
					);
				}
			} else {
				this.#logger.info(`  ➡️  Depends on: (none)`);
			}

			if (dependents.size > 0) {
				const nonSelfDependents = Array.from(dependents).filter(
					(dep) => dep !== node,
				);
				if (nonSelfDependents.length > 0) {
					this.#logger.info(
						`  ⬅️  Referenced by: ${nonSelfDependents.join(', ')}`,
					);
				} else {
					this.#logger.info(`  ⬅️  Referenced by: (none)`);
				}
			}

			this.#logger.raw('');
		}

		if (cycles.length > 0) {
			this.#logger.header('❌ Circular Dependencies Detected');
			for (const cycle of cycles) {
				this.#logger.error(`🔄 ${cycle.join(' → ')}`);
			}
		} else {
			this.#logger.success('No circular dependencies detected');
		}

		this.#logger.raw('');
	}

	/**
	 * Validate no duplicate statement names across files
	 */
	validateNoDuplicateNames(statements: SqlStatement[]): void {
		const nameToFile = new Map<string, string>();
		const duplicates: Array<{ name: string; files: string[] }> = [];

		for (const statement of statements) {
			const name = statement.name;
			const fileName =
				statement.filePath.split('/').pop() || statement.filePath;

			if (nameToFile.has(name)) {
				const existingFile = nameToFile.get(name);
				if (!existingFile) {
					continue;
				}
				const existing = duplicates.find((d) => d.name === name);

				if (existing) {
					if (!existing.files.includes(fileName)) {
						existing.files.push(fileName);
					}
				} else {
					duplicates.push({
						name,
						files: [existingFile, fileName],
					});
				}
			} else {
				nameToFile.set(name, fileName);
			}
		}

		if (duplicates.length > 0) {
			throw DependencyError.duplicateStatementNames(duplicates);
		}
	}
}

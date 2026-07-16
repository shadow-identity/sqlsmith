import type { DependencyGraph } from '../types/dependency-graph.js';
import { DependencyError, ProcessingError } from '../types/errors.js';
import type { RelationKey } from '../types/relation-identifier.js';
import type { SqlStatement } from '../types/sql-statement.js';

export class TopologicalSorter {
	/** Sort statements with Kahn's algorithm and own the public cycle boundary. */
	sortStatements(
		statements: SqlStatement[],
		graph: DependencyGraph<RelationKey>,
	): SqlStatement[] {
		const statementMap = new Map(
			statements.flatMap((statement) =>
				statement.identifier
					? [[statement.identifier.key, statement] as const]
					: [],
			),
		);
		const inDegree = new Map<RelationKey, number>();
		const queue: RelationKey[] = [];

		for (const node of graph.nodes) {
			const dependencies = graph.edges.get(node) ?? new Set();
			const degree = [...dependencies].filter(
				(dependency) => dependency !== node,
			).length;
			inDegree.set(node, degree);
			if (degree === 0) queue.push(node);
		}

		const sortedKeys: RelationKey[] = [];
		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) break;
			sortedKeys.push(current);

			for (const dependent of graph.reversedEdges.get(current) ?? new Set()) {
				if (dependent === current) continue;
				const degree = (inDegree.get(dependent) ?? 0) - 1;
				inDegree.set(dependent, degree);
				if (degree === 0) queue.push(dependent);
			}
		}

		if (sortedKeys.length !== graph.nodes.size) {
			const remaining = new Set(
				[...graph.nodes].filter((node) => !sortedKeys.includes(node)),
			);
			const cycleKeys = this.#findCycle(graph, remaining);
			if (cycleKeys) {
				const cycleDisplays = cycleKeys.map(
					(key) => statementMap.get(key)?.identifier?.display ?? key,
				);
				throw DependencyError.circularDependency([cycleDisplays], [cycleKeys]);
			}
			throw ProcessingError.internalError(
				'Topological sort did not process every graph node',
			);
		}

		return sortedKeys.map((key) => {
			const statement = statementMap.get(key);
			if (!statement) {
				throw ProcessingError.internalError(
					`Graph node '${key}' has no matching statement`,
				);
			}
			return statement;
		});
	}

	#findCycle(
		graph: DependencyGraph<RelationKey>,
		candidates: ReadonlySet<RelationKey>,
	): RelationKey[] | undefined {
		const state = new Map<RelationKey, 'visiting' | 'visited'>();
		const path: RelationKey[] = [];

		const visit = (node: RelationKey): RelationKey[] | undefined => {
			state.set(node, 'visiting');
			path.push(node);

			for (const dependency of graph.edges.get(node) ?? new Set()) {
				if (dependency === node || !candidates.has(dependency)) continue;
				if (state.get(dependency) === 'visiting') {
					return path.slice(path.indexOf(dependency)).concat(dependency);
				}
				if (!state.has(dependency)) {
					const cycle = visit(dependency);
					if (cycle) return cycle;
				}
			}

			path.pop();
			state.set(node, 'visited');
			return undefined;
		};

		for (const node of candidates) {
			if (state.has(node)) continue;
			const cycle = visit(node);
			if (cycle) return cycle;
		}
		return undefined;
	}
}

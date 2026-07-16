import type { DependencyGraph } from '../types/dependency-graph.js';
import { DependencyError, ProcessingError } from '../types/errors.js';
import type { SqlStatement } from '../types/sql-statement.js';

export class TopologicalSorter {
	/** Sort statements with Kahn's algorithm and own the public cycle boundary. */
	sortStatements(
		statements: SqlStatement[],
		graph: DependencyGraph<string>,
	): SqlStatement[] {
		const statementMap = new Map(
			statements.map((statement) => [statement.name, statement]),
		);
		const inDegree = new Map<string, number>();
		const queue: string[] = [];

		for (const node of graph.nodes) {
			const dependencies = graph.edges.get(node) ?? new Set();
			const degree = [...dependencies].filter(
				(dependency) => dependency !== node,
			).length;
			inDegree.set(node, degree);
			if (degree === 0) queue.push(node);
		}

		const sortedNames: string[] = [];
		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) break;
			sortedNames.push(current);

			for (const dependent of graph.reversedEdges.get(current) ?? new Set()) {
				if (dependent === current) continue;
				const degree = (inDegree.get(dependent) ?? 0) - 1;
				inDegree.set(dependent, degree);
				if (degree === 0) queue.push(dependent);
			}
		}

		if (sortedNames.length !== graph.nodes.size) {
			const remaining = new Set(
				[...graph.nodes].filter((node) => !sortedNames.includes(node)),
			);
			const cycle = this.#findCycle(graph, remaining);
			if (cycle) throw DependencyError.circularDependency([cycle]);
			throw ProcessingError.internalError(
				'Topological sort did not process every graph node',
			);
		}

		return sortedNames.map((name) => {
			const statement = statementMap.get(name);
			if (!statement) {
				throw ProcessingError.internalError(
					`Graph node '${name}' has no matching statement`,
				);
			}
			return statement;
		});
	}

	#findCycle(
		graph: DependencyGraph<string>,
		candidates: ReadonlySet<string>,
	): string[] | undefined {
		const state = new Map<string, 'visiting' | 'visited'>();
		const path: string[] = [];

		const visit = (node: string): string[] | undefined => {
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

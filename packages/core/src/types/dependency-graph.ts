export interface DependencyGraph<T = string> {
	nodes: Set<T>;
	edges: Map<T, Set<T>>; // item -> set of items it depends on
	reversedEdges: Map<T, Set<T>>; // item -> set of items that depend on it
}

export interface GraphNode {
	id: string;
	data: any;
	dependencies: string[];
}

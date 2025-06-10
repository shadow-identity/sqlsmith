export interface DependencyGraph<T = string> {
    nodes: Set<T>;
    edges: Map<T, Set<T>>;
    reversedEdges: Map<T, Set<T>>;
}
export interface GraphNode {
    id: string;
    data: any;
    dependencies: string[];
}
//# sourceMappingURL=dependency-graph.d.ts.map
import type { DependencyGraph } from '../types/dependency-graph.js';
import type { SqlFile, SqlStatement } from '../types/sql-statement.js';
import type { Logger } from './logger.js';
export declare class DependencyAnalyzer {
    #private;
    constructor(logger: Logger);
    /**
     * Build a dependency graph from SQL statements
     */
    buildStatementGraph(statements: SqlStatement[]): DependencyGraph<string>;
    /**
     * Build dependency graph from SQL files (legacy compatibility)
     */
    buildFileGraph(sqlFiles: SqlFile[]): DependencyGraph<string>;
    /**
     * Detect circular dependencies using DFS
     * Self-referencing items (hierarchical structures) are not considered circular dependencies
     */
    detectCycles(graph: DependencyGraph<string>): string[][];
    /**
     * Visualize dependency graph for debugging
     */
    visualizeDependencyGraph(graph: DependencyGraph<string>, statements?: SqlStatement[], cycles?: string[][]): void;
    /**
     * Validate no duplicate statement names across files
     */
    validateNoDuplicateNames(statements: SqlStatement[]): void;
}
//# sourceMappingURL=dependency-analyzer.d.ts.map
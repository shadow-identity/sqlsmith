import pkg from 'node-sql-parser';
export type SqlDependency = {
    tableName: string;
    dependsOn: string[];
};
export type SqlFile = {
    path: string;
    content: string;
    ast?: any;
    dependencies: SqlDependency[];
};
export type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'bigquery';
export type DependencyGraph = {
    nodes: Set<string>;
    edges: Map<string, Set<string>>;
    reversedEdges: Map<string, Set<string>>;
};
export declare class SqlMerger {
    parser: pkg.Parser;
    /**
     * Find all SQL files in a directory
     */
    findSqlFiles: (directoryPath: string) => string[];
    /**
     * Parse a single SQL statement and extract table dependencies
     */
    parseStatement: (sql: string, dialect?: SqlDialect) => {
        ast: any;
        dependencies: SqlDependency[];
    };
    /**
     * Extract table dependencies from AST and table list
     */
    extractDependencies: (ast: any, tableList: string[]) => SqlDependency[];
    /**
     * Build a dependency graph from SQL files
     */
    buildDependencyGraph: (sqlFiles: SqlFile[]) => DependencyGraph;
    /**
     * Detect circular dependencies using DFS
     * Self-referencing tables (hierarchical structures) are not considered circular dependencies
     */
    detectCycles: (graph: DependencyGraph) => string[][];
    /**
     * Visualize the dependency graph
     */
    visualizeDependencyGraph: (graph: DependencyGraph, cycles?: string[][]) => void;
    /**
     * Parse SQL files and extract table dependencies
     * Phase 2: Actually parse SQL content using AST
     */
    parseSqlFile: (directoryPath: string, dialect?: SqlDialect, options?: {
        allowReorderDropComments?: boolean;
    }) => SqlFile[];
    /**
     * Validate statement order within files that contain multiple CREATE TABLE statements
     */
    validateFileStatementOrder: (sqlFiles: SqlFile[]) => void;
    /**
     * Parse a single SQL file
     */
    parseSingleFile: (filePath: string, dialect?: SqlDialect, options?: {
        allowReorderDropComments?: boolean;
    }) => SqlFile;
    /**
     * Perform topological sort on SQL dependencies using Kahn's algorithm
     * Self-references are excluded from in-degree calculation
     */
    topologicalSort: (files: SqlFile[]) => SqlFile[];
    /**
     * Merge multiple SQL files into one with proper ordering
     */
    mergeFiles: (files: SqlFile[], options?: {
        addComments?: boolean;
        separateStatements?: boolean;
        includeHeader?: boolean;
        outputPath?: string;
    }) => string;
    /**
     * Validate no duplicate table names across files
     */
    validateNoDuplicateTableNames: (sqlFiles: SqlFile[]) => void;
}
//# sourceMappingURL=sql-merger.d.ts.map
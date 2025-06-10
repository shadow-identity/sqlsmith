import type { DependencyGraph } from '../types/dependency-graph.js';
import type { SqlFile, SqlStatement } from '../types/sql-statement.js';
import type { Logger } from './logger.js';
export declare class TopologicalSorter {
    #private;
    constructor(logger: Logger);
    /**
     * Sort SQL statements using Kahn's algorithm
     */
    sortStatements(statements: SqlStatement[], graph: DependencyGraph<string>): SqlStatement[];
    /**
     * Sort SQL files (legacy compatibility method)
     */
    sortFiles(files: SqlFile[], graph: DependencyGraph<string>): SqlFile[];
}
//# sourceMappingURL=topological-sorter.d.ts.map
export class TopologicalSorter {
    #logger;
    constructor(logger) {
        this.#logger = logger;
    }
    /**
     * Sort SQL statements using Kahn's algorithm
     */
    sortStatements(statements, graph) {
        // Create maps for quick lookups
        const statementMap = new Map();
        const fileMap = new Map();
        for (const statement of statements) {
            statementMap.set(statement.name, statement);
            fileMap.set(statement.name, statement.filePath);
        }
        // Kahn's algorithm implementation
        const inDegree = new Map();
        const queue = [];
        // Initialize in-degree for all nodes
        for (const node of graph.nodes) {
            const dependencies = graph.edges.get(node) || new Set();
            // Exclude self-references from in-degree calculation (hierarchical structures)
            const nonSelfDependencies = Array.from(dependencies).filter(dep => dep !== node);
            inDegree.set(node, nonSelfDependencies.length);
            // Add nodes with no dependencies to the queue
            if (nonSelfDependencies.length === 0) {
                queue.push(node);
            }
        }
        const sortedNames = [];
        // Process the queue
        while (queue.length > 0) {
            const current = queue.shift();
            sortedNames.push(current);
            // Update in-degree for all dependents
            const dependents = graph.reversedEdges.get(current) || new Set();
            for (const dependent of dependents) {
                // Skip self-references in dependency processing
                if (dependent === current) {
                    continue;
                }
                const currentDegree = inDegree.get(dependent) || 0;
                const newDegree = currentDegree - 1;
                inDegree.set(dependent, newDegree);
                // If this statement now has no more dependencies, add it to queue
                if (newDegree === 0) {
                    queue.push(dependent);
                }
            }
        }
        // Verify we processed all nodes
        if (sortedNames.length !== graph.nodes.size) {
            throw new Error('Topological sort failed: not all nodes were processed (unexpected cycle detected)');
        }
        // Convert sorted names back to SQL statements
        const sortedStatements = [];
        for (const name of sortedNames) {
            const statement = statementMap.get(name);
            if (statement) {
                sortedStatements.push(statement);
            }
        }
        this.#logSortResults(sortedStatements);
        return sortedStatements;
    }
    /**
     * Sort SQL files (legacy compatibility method)
     */
    sortFiles(files, graph) {
        // Extract all statements from files
        const allStatements = [];
        const fileToStatements = new Map();
        for (const file of files) {
            fileToStatements.set(file.path, file.statements);
            allStatements.push(...file.statements);
        }
        // Sort statements
        const sortedStatements = this.sortStatements(allStatements, graph);
        // Convert back to files in order, ensuring each file appears only once
        const sortedFiles = [];
        const processedFiles = new Set();
        for (const statement of sortedStatements) {
            if (!processedFiles.has(statement.filePath)) {
                const originalFile = files.find((f) => f.path === statement.filePath);
                if (originalFile) {
                    sortedFiles.push(originalFile);
                    processedFiles.add(statement.filePath);
                }
            }
        }
        return sortedFiles;
    }
    #logSortResults(sortedStatements) {
        this.#logger.header('🔄 Topological Sort Result', '-');
        sortedStatements.forEach((statement, index) => {
            const fileName = statement.filePath.split('/').pop();
            const type = statement.type.toUpperCase();
            this.#logger.info(`${index + 1}. ${fileName} (${type}: ${statement.name})`);
        });
        this.#logger.raw('');
    }
}
//# sourceMappingURL=topological-sorter.js.map
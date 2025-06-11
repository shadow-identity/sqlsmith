export class CreateViewProcessor {
    canProcess(statement) {
        return statement?.type === 'create' && statement?.keyword === 'view';
    }
    getHandledTypes() {
        return ['view'];
    }
    extractStatements(ast, filePath, dialect) {
        const statements = [];
        const astStatements = Array.isArray(ast) ? ast : [ast];
        for (const statement of astStatements) {
            if (this.canProcess(statement)) {
                const viewName = statement.view?.view || statement.view?.table || statement.name;
                if (viewName) {
                    const dependencies = this.#extractViewDependencies(statement);
                    statements.push({
                        type: 'view',
                        name: viewName,
                        dependsOn: dependencies,
                        filePath,
                        content: '', // Will be filled by the file parser
                        ast: statement,
                    });
                }
            }
        }
        return statements;
    }
    #extractViewDependencies(statement) {
        const dependencies = [];
        // Extract table/view references from the SELECT statement
        const selectStatement = statement.select || statement.definition;
        if (selectStatement) {
            const tableReferences = this.#extractTableReferencesFromSelect(selectStatement);
            for (const tableName of tableReferences) {
                if (!dependencies.find((d) => d.name === tableName)) {
                    // We don't know if it's a table or view at this point,
                    // dependency analyzer will resolve this later
                    dependencies.push({
                        name: tableName,
                        type: 'table', // Default assumption, will be refined later
                    });
                }
            }
        }
        return dependencies;
    }
    #extractTableReferencesFromSelect(selectStatement) {
        const tables = [];
        // Handle different SELECT statement structures
        if (selectStatement.from) {
            const fromClauses = Array.isArray(selectStatement.from)
                ? selectStatement.from
                : [selectStatement.from];
            for (const fromClause of fromClauses) {
                if (fromClause.table) {
                    const tableName = fromClause.table;
                    if (tableName && typeof tableName === 'string') {
                        tables.push(tableName);
                    }
                }
            }
        }
        // Handle JOINs
        if (selectStatement.join) {
            const joins = Array.isArray(selectStatement.join)
                ? selectStatement.join
                : [selectStatement.join];
            for (const join of joins) {
                if (join.table) {
                    const tableName = join.table;
                    if (tableName && typeof tableName === 'string') {
                        tables.push(tableName);
                    }
                }
            }
        }
        // Handle subqueries recursively
        if (selectStatement.subquery) {
            const subqueryTables = this.#extractTableReferencesFromSelect(selectStatement.subquery);
            tables.push(...subqueryTables);
        }
        return [...new Set(tables)]; // Remove duplicates
    }
}
//# sourceMappingURL=create-view-processor.js.map
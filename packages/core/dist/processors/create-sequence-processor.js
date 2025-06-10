export class CreateSequenceProcessor {
    canProcess(statement) {
        return statement?.type === 'create' && statement?.keyword === 'sequence';
    }
    getHandledTypes() {
        return ['sequence'];
    }
    extractStatements(ast, filePath, dialect) {
        const statements = [];
        const astStatements = Array.isArray(ast) ? ast : [ast];
        for (const statement of astStatements) {
            if (this.canProcess(statement)) {
                const sequenceName = statement.sequence?.[0]?.table ||
                    statement.sequence?.table ||
                    statement.name;
                if (sequenceName) {
                    // Sequences typically have no dependencies - they're usually created first
                    const dependencies = [];
                    statements.push({
                        type: 'sequence',
                        name: sequenceName,
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
}
//# sourceMappingURL=create-sequence-processor.js.map
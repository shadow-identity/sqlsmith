export var ErrorCode;
(function (ErrorCode) {
    // File system errors
    ErrorCode["DIRECTORY_NOT_FOUND"] = "DIRECTORY_NOT_FOUND";
    ErrorCode["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
    ErrorCode["NO_SQL_FILES"] = "NO_SQL_FILES";
    ErrorCode["INVALID_OUTPUT_PATH"] = "INVALID_OUTPUT_PATH";
    // Parsing errors
    ErrorCode["INVALID_SQL_SYNTAX"] = "INVALID_SQL_SYNTAX";
    ErrorCode["UNSUPPORTED_DIALECT"] = "UNSUPPORTED_DIALECT";
    ErrorCode["PARSING_FAILED"] = "PARSING_FAILED";
    // Dependency errors
    ErrorCode["CIRCULAR_DEPENDENCY"] = "CIRCULAR_DEPENDENCY";
    ErrorCode["DUPLICATE_STATEMENT_NAMES"] = "DUPLICATE_STATEMENT_NAMES";
    ErrorCode["MISSING_DEPENDENCY"] = "MISSING_DEPENDENCY";
    ErrorCode["INVALID_STATEMENT_ORDER"] = "INVALID_STATEMENT_ORDER";
    // Configuration errors
    ErrorCode["INVALID_OPTIONS"] = "INVALID_OPTIONS";
    ErrorCode["MISSING_REQUIRED_OPTION"] = "MISSING_REQUIRED_OPTION";
    // Processing errors
    ErrorCode["PROCESSOR_ERROR"] = "PROCESSOR_ERROR";
    ErrorCode["MERGE_FAILED"] = "MERGE_FAILED";
    // General errors
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
})(ErrorCode || (ErrorCode = {}));
export class SqlMergerError extends Error {
    code;
    context;
    originalError;
    constructor(message, code, context, originalError) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.context = context;
        this.originalError = originalError;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * Get a formatted error message with context
     */
    getDetailedMessage() {
        let message = `[${this.code}] ${this.message}`;
        if (this.context && Object.keys(this.context).length > 0) {
            const contextStr = Object.entries(this.context)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            message += ` (${contextStr})`;
        }
        if (this.originalError) {
            message += `\nCaused by: ${this.originalError.message}`;
        }
        return message;
    }
}
export class FileSystemError extends SqlMergerError {
    constructor(message, code, context, originalError) {
        super(message, code, context, originalError);
    }
    static directoryNotFound(path) {
        return new FileSystemError(`Directory not found: ${path}`, ErrorCode.DIRECTORY_NOT_FOUND, { path });
    }
    static fileNotFound(path) {
        return new FileSystemError(`File not found: ${path}`, ErrorCode.FILE_NOT_FOUND, { path });
    }
    static noSqlFiles(directory) {
        return new FileSystemError(`No SQL files found in directory: ${directory}`, ErrorCode.NO_SQL_FILES, { directory });
    }
    static invalidOutputPath(path) {
        return new FileSystemError(`Invalid output path: ${path}`, ErrorCode.INVALID_OUTPUT_PATH, { path });
    }
}
export class ParsingError extends SqlMergerError {
    constructor(message, code, context, originalError) {
        super(message, code, context, originalError);
    }
    static invalidSqlSyntax(filePath, lineNumber, originalError) {
        return new ParsingError(`Invalid SQL syntax in file: ${filePath}${lineNumber ? ` at line ${lineNumber}` : ''}`, ErrorCode.INVALID_SQL_SYNTAX, { filePath, lineNumber }, originalError);
    }
    static unsupportedDialect(dialect) {
        return new ParsingError(`Unsupported SQL dialect: ${dialect}`, ErrorCode.UNSUPPORTED_DIALECT, { dialect });
    }
    static parsingFailed(filePath, originalError) {
        return new ParsingError(`Failed to parse SQL file: ${filePath}`, ErrorCode.PARSING_FAILED, { filePath }, originalError);
    }
}
export class DependencyError extends SqlMergerError {
    constructor(message, code, context, originalError) {
        super(message, code, context, originalError);
    }
    static circularDependency(cycles) {
        const cycleDescriptions = cycles.map(cycle => cycle.join(' → ')).join(', ');
        return new DependencyError(`Circular dependencies detected: ${cycleDescriptions}`, ErrorCode.CIRCULAR_DEPENDENCY, { cycles, cycleDescriptions });
    }
    static duplicateStatementNames(duplicates) {
        const duplicateNames = duplicates.map(d => d.name).join(', ');
        return new DependencyError(`Duplicate statement names found: ${duplicateNames}`, ErrorCode.DUPLICATE_STATEMENT_NAMES, { duplicates, duplicateNames });
    }
    static missingDependency(statementName, dependencyName) {
        return new DependencyError(`Statement '${statementName}' depends on '${dependencyName}' which was not found`, ErrorCode.MISSING_DEPENDENCY, { statementName, dependencyName });
    }
    static invalidStatementOrder(fileName, details) {
        return new DependencyError(`Invalid statement order in file '${fileName}': ${details}`, ErrorCode.INVALID_STATEMENT_ORDER, { fileName, details });
    }
}
export class ConfigurationError extends SqlMergerError {
    constructor(message, code, context, originalError) {
        super(message, code, context, originalError);
    }
    static invalidOptions(optionName, value) {
        return new ConfigurationError(`Invalid option '${optionName}': ${value}`, ErrorCode.INVALID_OPTIONS, { optionName, value });
    }
    static missingRequiredOption(optionName) {
        return new ConfigurationError(`Missing required option: ${optionName}`, ErrorCode.MISSING_REQUIRED_OPTION, { optionName });
    }
}
export class ProcessingError extends SqlMergerError {
    constructor(message, code, context, originalError) {
        super(message, code, context, originalError);
    }
    static processorError(processorName, originalError) {
        return new ProcessingError(`Error in processor '${processorName}'`, ErrorCode.PROCESSOR_ERROR, { processorName }, originalError);
    }
    static mergeFailed(reason, originalError) {
        return new ProcessingError(`Failed to merge SQL files: ${reason}`, ErrorCode.MERGE_FAILED, { reason }, originalError);
    }
}
//# sourceMappingURL=errors.js.map
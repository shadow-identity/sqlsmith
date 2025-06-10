export declare enum ErrorCode {
    DIRECTORY_NOT_FOUND = "DIRECTORY_NOT_FOUND",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    NO_SQL_FILES = "NO_SQL_FILES",
    INVALID_OUTPUT_PATH = "INVALID_OUTPUT_PATH",
    INVALID_SQL_SYNTAX = "INVALID_SQL_SYNTAX",
    UNSUPPORTED_DIALECT = "UNSUPPORTED_DIALECT",
    PARSING_FAILED = "PARSING_FAILED",
    CIRCULAR_DEPENDENCY = "CIRCULAR_DEPENDENCY",
    DUPLICATE_STATEMENT_NAMES = "DUPLICATE_STATEMENT_NAMES",
    MISSING_DEPENDENCY = "MISSING_DEPENDENCY",
    INVALID_STATEMENT_ORDER = "INVALID_STATEMENT_ORDER",
    INVALID_OPTIONS = "INVALID_OPTIONS",
    MISSING_REQUIRED_OPTION = "MISSING_REQUIRED_OPTION",
    PROCESSOR_ERROR = "PROCESSOR_ERROR",
    MERGE_FAILED = "MERGE_FAILED",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    VALIDATION_ERROR = "VALIDATION_ERROR"
}
export declare abstract class SqlMergerError extends Error {
    readonly code: ErrorCode;
    readonly context?: Record<string, unknown>;
    readonly originalError?: Error;
    constructor(message: string, code: ErrorCode, context?: Record<string, unknown>, originalError?: Error);
    /**
     * Get a formatted error message with context
     */
    getDetailedMessage(): string;
}
export declare class FileSystemError extends SqlMergerError {
    constructor(message: string, code: ErrorCode, context?: Record<string, unknown>, originalError?: Error);
    static directoryNotFound(path: string): FileSystemError;
    static fileNotFound(path: string): FileSystemError;
    static noSqlFiles(directory: string): FileSystemError;
    static invalidOutputPath(path: string): FileSystemError;
}
export declare class ParsingError extends SqlMergerError {
    constructor(message: string, code: ErrorCode, context?: Record<string, unknown>, originalError?: Error);
    static invalidSqlSyntax(filePath: string, lineNumber?: number, originalError?: Error): ParsingError;
    static unsupportedDialect(dialect: string): ParsingError;
    static parsingFailed(filePath: string, originalError?: Error): ParsingError;
}
export declare class DependencyError extends SqlMergerError {
    constructor(message: string, code: ErrorCode, context?: Record<string, unknown>, originalError?: Error);
    static circularDependency(cycles: string[][]): DependencyError;
    static duplicateStatementNames(duplicates: Array<{
        name: string;
        files: string[];
    }>): DependencyError;
    static missingDependency(statementName: string, dependencyName: string): DependencyError;
    static invalidStatementOrder(fileName: string, details: string): DependencyError;
}
export declare class ConfigurationError extends SqlMergerError {
    constructor(message: string, code: ErrorCode, context?: Record<string, unknown>, originalError?: Error);
    static invalidOptions(optionName: string, value: unknown): ConfigurationError;
    static missingRequiredOption(optionName: string): ConfigurationError;
}
export declare class ProcessingError extends SqlMergerError {
    constructor(message: string, code: ErrorCode, context?: Record<string, unknown>, originalError?: Error);
    static processorError(processorName: string, originalError?: Error): ProcessingError;
    static mergeFailed(reason: string, originalError?: Error): ProcessingError;
}
//# sourceMappingURL=errors.d.ts.map
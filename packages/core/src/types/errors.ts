export enum ErrorCode {
	// File system errors
	DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
	FILE_NOT_FOUND = 'FILE_NOT_FOUND',
	NO_SQL_FILES = 'NO_SQL_FILES',
	INVALID_OUTPUT_PATH = 'INVALID_OUTPUT_PATH',
	
	// Parsing errors
	INVALID_SQL_SYNTAX = 'INVALID_SQL_SYNTAX',
	UNSUPPORTED_DIALECT = 'UNSUPPORTED_DIALECT',
	PARSING_FAILED = 'PARSING_FAILED',
	
	// Dependency errors
	CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
	DUPLICATE_STATEMENT_NAMES = 'DUPLICATE_STATEMENT_NAMES',
	MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',
	INVALID_STATEMENT_ORDER = 'INVALID_STATEMENT_ORDER',
	
	// Configuration errors
	INVALID_OPTIONS = 'INVALID_OPTIONS',
	MISSING_REQUIRED_OPTION = 'MISSING_REQUIRED_OPTION',
	
	// Processing errors
	PROCESSOR_ERROR = 'PROCESSOR_ERROR',
	MERGE_FAILED = 'MERGE_FAILED',
	
	// General errors
	INTERNAL_ERROR = 'INTERNAL_ERROR',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export abstract class SqlMergerError extends Error {
	readonly code: ErrorCode;
	readonly context?: Record<string, unknown>;
	readonly originalError?: Error;

	constructor(
		message: string,
		code: ErrorCode,
		context?: Record<string, unknown>,
		originalError?: Error,
	) {
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
	getDetailedMessage(): string {
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
	constructor(
		message: string,
		code: ErrorCode,
		context?: Record<string, unknown>,
		originalError?: Error,
	) {
		super(message, code, context, originalError);
	}

	static directoryNotFound(path: string): FileSystemError {
		return new FileSystemError(
			`Directory not found: ${path}`,
			ErrorCode.DIRECTORY_NOT_FOUND,
			{ path },
		);
	}

	static fileNotFound(path: string): FileSystemError {
		return new FileSystemError(
			`File not found: ${path}`,
			ErrorCode.FILE_NOT_FOUND,
			{ path },
		);
	}

	static noSqlFiles(directory: string): FileSystemError {
		return new FileSystemError(
			`No SQL files found in directory: ${directory}`,
			ErrorCode.NO_SQL_FILES,
			{ directory },
		);
	}

	static invalidOutputPath(path: string): FileSystemError {
		return new FileSystemError(
			`Invalid output path: ${path}`,
			ErrorCode.INVALID_OUTPUT_PATH,
			{ path },
		);
	}
}

export class ParsingError extends SqlMergerError {
	constructor(
		message: string,
		code: ErrorCode,
		context?: Record<string, unknown>,
		originalError?: Error,
	) {
		super(message, code, context, originalError);
	}

	static invalidSqlSyntax(filePath: string, lineNumber?: number, originalError?: Error): ParsingError {
		return new ParsingError(
			`Invalid SQL syntax in file: ${filePath}${lineNumber ? ` at line ${lineNumber}` : ''}`,
			ErrorCode.INVALID_SQL_SYNTAX,
			{ filePath, lineNumber },
			originalError,
		);
	}

	static unsupportedDialect(dialect: string): ParsingError {
		return new ParsingError(
			`Unsupported SQL dialect: ${dialect}`,
			ErrorCode.UNSUPPORTED_DIALECT,
			{ dialect },
		);
	}

	static parsingFailed(filePath: string, originalError?: Error): ParsingError {
		return new ParsingError(
			`Failed to parse SQL file: ${filePath}`,
			ErrorCode.PARSING_FAILED,
			{ filePath },
			originalError,
		);
	}
}

export class DependencyError extends SqlMergerError {
	constructor(
		message: string,
		code: ErrorCode,
		context?: Record<string, unknown>,
		originalError?: Error,
	) {
		super(message, code, context, originalError);
	}

	static circularDependency(cycles: string[][]): DependencyError {
		const cycleDescriptions = cycles.map(cycle => cycle.join(' → ')).join(', ');
		return new DependencyError(
			`Circular dependencies detected: ${cycleDescriptions}`,
			ErrorCode.CIRCULAR_DEPENDENCY,
			{ cycles, cycleDescriptions },
		);
	}

	static duplicateStatementNames(duplicates: Array<{ name: string; files: string[] }>): DependencyError {
		const duplicateNames = duplicates.map(d => d.name).join(', ');
		return new DependencyError(
			`Duplicate statement names found: ${duplicateNames}`,
			ErrorCode.DUPLICATE_STATEMENT_NAMES,
			{ duplicates, duplicateNames },
		);
	}

	static missingDependency(statementName: string, dependencyName: string): DependencyError {
		return new DependencyError(
			`Statement '${statementName}' depends on '${dependencyName}' which was not found`,
			ErrorCode.MISSING_DEPENDENCY,
			{ statementName, dependencyName },
		);
	}

	static invalidStatementOrder(fileName: string, details: string): DependencyError {
		return new DependencyError(
			`Invalid statement order in file '${fileName}': ${details}`,
			ErrorCode.INVALID_STATEMENT_ORDER,
			{ fileName, details },
		);
	}
}

export class ConfigurationError extends SqlMergerError {
	constructor(
		message: string,
		code: ErrorCode,
		context?: Record<string, unknown>,
		originalError?: Error,
	) {
		super(message, code, context, originalError);
	}

	static invalidOptions(optionName: string, value: unknown): ConfigurationError {
		return new ConfigurationError(
			`Invalid option '${optionName}': ${value}`,
			ErrorCode.INVALID_OPTIONS,
			{ optionName, value },
		);
	}

	static missingRequiredOption(optionName: string): ConfigurationError {
		return new ConfigurationError(
			`Missing required option: ${optionName}`,
			ErrorCode.MISSING_REQUIRED_OPTION,
			{ optionName },
		);
	}
}

export class ProcessingError extends SqlMergerError {
	constructor(
		message: string,
		code: ErrorCode,
		context?: Record<string, unknown>,
		originalError?: Error,
	) {
		super(message, code, context, originalError);
	}

	static processorError(processorName: string, originalError?: Error): ProcessingError {
		return new ProcessingError(
			`Error in processor '${processorName}'`,
			ErrorCode.PROCESSOR_ERROR,
			{ processorName },
			originalError,
		);
	}

	static mergeFailed(reason: string, originalError?: Error): ProcessingError {
		return new ProcessingError(
			`Failed to merge SQL files: ${reason}`,
			ErrorCode.MERGE_FAILED,
			{ reason },
			originalError,
		);
	}
} 
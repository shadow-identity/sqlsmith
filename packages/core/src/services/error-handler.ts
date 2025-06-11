import { ErrorCode, SqlMergerError } from '../types/errors.js';
import { Logger } from './logger.js';

export class ErrorHandler {
	#logger: Logger;

	constructor(logger: Logger) {
		this.#logger = logger;
	}

	/**
	 * Handle an error with appropriate logging and optional re-throwing
	 */
	handleError(error: unknown, shouldRethrow = true): never | undefined {
		if (error instanceof SqlMergerError) {
			this.#logger.error(error.getDetailedMessage());

			if (error.originalError) {
				this.#logger.debug('Original error stack:', error.originalError.stack);
			}
		} else if (error instanceof Error) {
			this.#logger.error(`Unexpected error: ${error.message}`);

			this.#logger.debug('Error stack:', error.stack);
		} else {
			this.#logger.error(`Unknown error: ${String(error)}`);
		}

		if (shouldRethrow) {
			throw error;
		}
	}

	/**
	 * Wrap a function with error handling
	 */
	wrapWithErrorHandling = <T extends unknown[], R>(
		fn: (...args: T) => R,
		context?: string,
	): ((...args: T) => R) => {
		return (...args: T): R => {
			try {
				return fn(...args);
			} catch (error) {
				if (context) {
					this.#logger.debug(`Error in ${context}`);
				}
				this.handleError(error);
				// This line will never be reached due to handleError throwing, but needed for type safety
				throw error;
			}
		};
	};

	/**
	 * Wrap an async function with error handling
	 */
	wrapWithAsyncErrorHandling = <T extends unknown[], R>(
		fn: (...args: T) => Promise<R>,
		context?: string,
	): ((...args: T) => Promise<R>) => {
		return async (...args: T): Promise<R> => {
			try {
				return await fn(...args);
			} catch (error) {
				if (context) {
					this.#logger.debug(`Error in ${context}`);
				}
				this.handleError(error);
				// This line will never be reached due to handleError throwing, but needed for type safety
				throw error;
			}
		};
	};

	/**
	 * Create a SqlMergerError from a generic error
	 */
	createSqlMergerError(
		originalError: unknown,
		code: ErrorCode,
		message?: string,
		context?: Record<string, unknown>,
	): SqlMergerError {
		const errorMessage =
			message ||
			(originalError instanceof Error
				? originalError.message
				: String(originalError));

		const sqlError = new (class extends SqlMergerError {})(
			errorMessage,
			code,
			context,
			originalError instanceof Error ? originalError : undefined,
		);

		return sqlError;
	}

	/**
	 * Handle CLI command errors with proper exit codes
	 */
	handleCommandError(error: unknown, quiet = false): never {
		// Don't log if already logged by handleError
		if (!(error instanceof SqlMergerError)) {
			const tempLogger = new Logger({ logLevel: quiet ? 'error' : 'info' });
			tempLogger.error(error instanceof Error ? error.message : String(error));
		}

		// Exit with appropriate code based on error type
		let exitCode = 1;
		if (error instanceof SqlMergerError) {
			switch (error.code) {
				case ErrorCode.DIRECTORY_NOT_FOUND:
				case ErrorCode.FILE_NOT_FOUND:
				case ErrorCode.NO_SQL_FILES:
					exitCode = 2; // Input/file errors
					break;
				case ErrorCode.CIRCULAR_DEPENDENCY:
				case ErrorCode.DUPLICATE_STATEMENT_NAMES:
					exitCode = 3; // Dependency errors
					break;
				case ErrorCode.INVALID_OPTIONS:
				case ErrorCode.MISSING_REQUIRED_OPTION:
					exitCode = 4; // Configuration errors
					break;
				default:
					exitCode = 1; // General errors
			}
		}

		process.exit(exitCode);
	}
}

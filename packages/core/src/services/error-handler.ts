import type { ErrorCode } from '../types/errors.js';
import { SqlMergerError } from '../types/errors.js';
import type { Logger } from './logger.js';

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
}

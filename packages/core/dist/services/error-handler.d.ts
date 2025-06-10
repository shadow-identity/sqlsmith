import { ErrorCode, SqlMergerError } from '../types/errors.js';
import type { Logger } from './logger.js';
export declare class ErrorHandler {
    #private;
    constructor(logger: Logger);
    /**
     * Handle an error with appropriate logging and optional re-throwing
     */
    handleError(error: unknown, shouldRethrow?: boolean): never | void;
    /**
     * Wrap a function with error handling
     */
    wrapWithErrorHandling: <T extends unknown[], R>(fn: (...args: T) => R, context?: string) => ((...args: T) => R);
    /**
     * Wrap an async function with error handling
     */
    wrapWithAsyncErrorHandling: <T extends unknown[], R>(fn: (...args: T) => Promise<R>, context?: string) => ((...args: T) => Promise<R>);
    /**
     * Create a SqlMergerError from a generic error
     */
    createSqlMergerError(originalError: unknown, code: ErrorCode, message?: string, context?: Record<string, unknown>): SqlMergerError;
    /**
     * Handle CLI command errors with proper exit codes
     */
    handleCommandError(error: unknown, quiet?: boolean): never;
}
//# sourceMappingURL=error-handler.d.ts.map
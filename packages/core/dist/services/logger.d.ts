export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LoggerOptions = {
    quiet?: boolean;
    verbose?: boolean;
};
export declare class Logger {
    #private;
    constructor(options?: LoggerOptions);
    /**
     * Log an error message (always shown unless quiet)
     */
    error: (message: string, ...args: unknown[]) => void;
    /**
     * Log a warning message
     */
    warn: (message: string, ...args: unknown[]) => void;
    /**
     * Log an info message
     */
    info: (message: string, ...args: unknown[]) => void;
    /**
     * Log a debug message (only in verbose mode)
     */
    debug: (message: string, ...args: unknown[]) => void;
    /**
     * Log a success message
     */
    success: (message: string, ...args: unknown[]) => void;
    /**
     * Log a header/section separator
     */
    header: (title: string, separator?: string) => void;
    /**
     * Log raw content without formatting
     */
    raw: (message: string, ...args: unknown[]) => void;
    /**
     * Create a new logger instance with different options
     */
    withOptions: (options: LoggerOptions) => Logger;
    /**
     * Check if quiet mode is enabled
     */
    get isQuiet(): boolean;
    /**
     * Check if verbose mode is enabled
     */
    get isVerbose(): boolean;
}
//# sourceMappingURL=logger.d.ts.map
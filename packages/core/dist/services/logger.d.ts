export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LoggerOptions = {
    logLevel?: LogLevel;
};
export declare class Logger {
    #private;
    constructor(options?: LoggerOptions);
    /**
     * Log an error message
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
     * Log a debug message
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
}
//# sourceMappingURL=logger.d.ts.map
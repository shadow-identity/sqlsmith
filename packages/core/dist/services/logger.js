export class Logger {
    #quiet;
    #verbose;
    constructor(options = {}) {
        this.#quiet = options.quiet ?? false;
        this.#verbose = options.verbose ?? false;
    }
    /**
     * Log an error message (always shown unless quiet)
     */
    error = (message, ...args) => {
        if (!this.#quiet) {
            console.error(`❌ ${message}`, ...args);
        }
    };
    /**
     * Log a warning message
     */
    warn = (message, ...args) => {
        if (!this.#quiet) {
            console.log(`⚠️  ${message}`, ...args);
        }
    };
    /**
     * Log an info message
     */
    info = (message, ...args) => {
        if (!this.#quiet) {
            console.log(message, ...args);
        }
    };
    /**
     * Log a debug message (only in verbose mode)
     */
    debug = (message, ...args) => {
        if (this.#verbose && !this.#quiet) {
            console.log(`🐛 ${message}`, ...args);
        }
    };
    /**
     * Log a success message
     */
    success = (message, ...args) => {
        if (!this.#quiet) {
            console.log(`✅ ${message}`, ...args);
        }
    };
    /**
     * Log a header/section separator
     */
    header = (title, separator = '=') => {
        if (!this.#quiet) {
            console.log(`\n${title}`);
            console.log(separator.repeat(Math.max(50, title.length)));
        }
    };
    /**
     * Log raw content without formatting
     */
    raw = (message, ...args) => {
        if (!this.#quiet) {
            console.log(message, ...args);
        }
    };
    /**
     * Create a new logger instance with different options
     */
    withOptions = (options) => {
        return new Logger({
            quiet: options.quiet ?? this.#quiet,
            verbose: options.verbose ?? this.#verbose,
        });
    };
    /**
     * Check if quiet mode is enabled
     */
    get isQuiet() {
        return this.#quiet;
    }
    /**
     * Check if verbose mode is enabled
     */
    get isVerbose() {
        return this.#verbose;
    }
}
//# sourceMappingURL=logger.js.map
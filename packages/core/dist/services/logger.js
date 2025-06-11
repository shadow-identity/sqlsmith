export class Logger {
    #logLevel;
    constructor(options = {}) {
        this.#logLevel = options.logLevel ?? 'info';
    }
    #shouldLog = (messageLevel) => {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.#logLevel);
        const messageLevelIndex = levels.indexOf(messageLevel);
        return messageLevelIndex <= currentLevelIndex;
    };
    /**
     * Log an error message
     */
    error = (message, ...args) => {
        if (this.#shouldLog('error')) {
            console.error(`❌ ${message}`, ...args);
        }
    };
    /**
     * Log a warning message
     */
    warn = (message, ...args) => {
        if (this.#shouldLog('warn')) {
            console.warn(`⚠️  ${message}`, ...args);
        }
    };
    /**
     * Log an info message
     */
    info = (message, ...args) => {
        if (this.#shouldLog('info')) {
            console.info(message, ...args);
        }
    };
    /**
     * Log a debug message
     */
    debug = (message, ...args) => {
        if (this.#shouldLog('debug')) {
            console.debug(`🐛 ${message}`, ...args);
        }
    };
    /**
     * Log a success message
     */
    success = (message, ...args) => {
        if (this.#shouldLog('info')) {
            console.info(`✅ ${message}`, ...args);
        }
    };
    /**
     * Log a header/section separator
     */
    header = (title, separator = '=') => {
        if (this.#shouldLog('info')) {
            console.info(`\n${title}`);
            console.info(separator.repeat(Math.max(50, title.length)));
        }
    };
    /**
     * Log raw content without formatting
     */
    raw = (message, ...args) => {
        if (this.#shouldLog('info')) {
            console.info(message, ...args);
        }
    };
}
//# sourceMappingURL=logger.js.map
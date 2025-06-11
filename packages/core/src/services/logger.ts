export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LoggerOptions = {
	logLevel?: LogLevel;
};

export class Logger {
	#logLevel: LogLevel;

	constructor(options: LoggerOptions = {}) {
		this.#logLevel = options.logLevel ?? 'info';
	}

	#shouldLog = (messageLevel: LogLevel): boolean => {
		const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
		const currentLevelIndex = levels.indexOf(this.#logLevel);
		const messageLevelIndex = levels.indexOf(messageLevel);
		return messageLevelIndex <= currentLevelIndex;
	};

	/**
	 * Log an error message
	 */
	error = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('error')) {
			console.error(`❌ ${message}`, ...args);
		}
	};

	/**
	 * Log a warning message
	 */
	warn = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('warn')) {
			console.warn(`⚠️  ${message}`, ...args);
		}
	};

	/**
	 * Log an info message
	 */
	info = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('info')) {
			console.info(message, ...args);
		}
	};

	/**
	 * Log a debug message
	 */
	debug = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('debug')) {
			console.debug(`🐛 ${message}`, ...args);
		}
	};

	/**
	 * Log a success message
	 */
	success = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('info')) {
			console.info(`✅ ${message}`, ...args);
		}
	};

	/**
	 * Log a header/section separator
	 */
	header = (title: string, separator = '='): void => {
		if (this.#shouldLog('info')) {
			console.info(`\n${title}`);
			console.info(separator.repeat(Math.max(50, title.length)));
		}
	};

	/**
	 * Log raw content without formatting
	 */
	raw = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('info')) {
			console.info(message, ...args);
		}
	};
}

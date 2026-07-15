import { format } from 'node:util';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LoggerOptions = {
	logLevel?: LogLevel;
};

/**
 * All log output goes to stderr: stdout is reserved for program output
 * (merged SQL), so piping the CLI produces a clean SQL file.
 */
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

	#write = (message: string, ...args: unknown[]): void => {
		process.stderr.write(`${format(message, ...args)}\n`);
	};

	/**
	 * Log an error message
	 */
	error = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('error')) {
			this.#write(`❌ ${message}`, ...args);
		}
	};

	/**
	 * Log a warning message
	 */
	warn = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('warn')) {
			this.#write(`⚠️  ${message}`, ...args);
		}
	};

	/**
	 * Log an info message
	 */
	info = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('info')) {
			this.#write(message, ...args);
		}
	};

	/**
	 * Log a debug message
	 */
	debug = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('debug')) {
			this.#write(`🐛 ${message}`, ...args);
		}
	};

	/**
	 * Log a success message
	 */
	success = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('info')) {
			this.#write(`✅ ${message}`, ...args);
		}
	};

	/**
	 * Log a header/section separator
	 */
	header = (title: string, separator = '='): void => {
		if (this.#shouldLog('info')) {
			this.#write(`\n${title}`);
			this.#write(separator.repeat(Math.max(50, title.length)));
		}
	};

	/**
	 * Log raw content without formatting
	 */
	raw = (message: string, ...args: unknown[]): void => {
		if (this.#shouldLog('info')) {
			this.#write(message, ...args);
		}
	};
}

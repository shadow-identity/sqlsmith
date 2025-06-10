export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LoggerOptions = {
	quiet?: boolean;
	verbose?: boolean;
};

export class Logger {
	#quiet: boolean;
	#verbose: boolean;

	constructor(options: LoggerOptions = {}) {
		this.#quiet = options.quiet ?? false;
		this.#verbose = options.verbose ?? false;
	}

	/**
	 * Log an error message (always shown unless quiet)
	 */
	error = (message: string, ...args: unknown[]): void => {
		if (!this.#quiet) {
			console.error(`❌ ${message}`, ...args);
		}
	};

	/**
	 * Log a warning message
	 */
	warn = (message: string, ...args: unknown[]): void => {
		if (!this.#quiet) {
			console.log(`⚠️  ${message}`, ...args);
		}
	};

	/**
	 * Log an info message
	 */
	info = (message: string, ...args: unknown[]): void => {
		if (!this.#quiet) {
			console.log(message, ...args);
		}
	};

	/**
	 * Log a debug message (only in verbose mode)
	 */
	debug = (message: string, ...args: unknown[]): void => {
		if (this.#verbose && !this.#quiet) {
			console.log(`🐛 ${message}`, ...args);
		}
	};

	/**
	 * Log a success message
	 */
	success = (message: string, ...args: unknown[]): void => {
		if (!this.#quiet) {
			console.log(`✅ ${message}`, ...args);
		}
	};

	/**
	 * Log a header/section separator
	 */
	header = (title: string, separator = '='): void => {
		if (!this.#quiet) {
			console.log(`\n${title}`);
			console.log(separator.repeat(Math.max(50, title.length)));
		}
	};

	/**
	 * Log raw content without formatting
	 */
	raw = (message: string, ...args: unknown[]): void => {
		if (!this.#quiet) {
			console.log(message, ...args);
		}
	};

	/**
	 * Create a new logger instance with different options
	 */
	withOptions = (options: LoggerOptions): Logger => {
		return new Logger({
			quiet: options.quiet ?? this.#quiet,
			verbose: options.verbose ?? this.#verbose,
		});
	};

	/**
	 * Check if quiet mode is enabled
	 */
	get isQuiet(): boolean {
		return this.#quiet;
	}

	/**
	 * Check if verbose mode is enabled
	 */
	get isVerbose(): boolean {
		return this.#verbose;
	}
} 
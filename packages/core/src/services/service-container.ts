import type { StatementProcessor } from '../processors/base-processor.js';
import { CreateSequenceProcessor } from '../processors/create-sequence-processor.js';
import { CreateTableProcessor } from '../processors/create-table-processor.js';
import { CreateViewProcessor } from '../processors/create-view-processor.js';
import type { SqlDialect } from '../types/sql-statement.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';
import { ErrorHandler } from './error-handler.js';
import { FileSystemValidator } from './file-system-validator.js';
import type { LoggerOptions } from './logger.js';
import { Logger } from './logger.js';
import { SqlFileMerger } from './sql-file-merger.js';
import { SqlFileParser } from './sql-file-parser.js';
import { TopologicalSorter } from './topological-sorter.js';

export interface ServiceConfiguration {
	// Logger configuration
	loggerOptions?: LoggerOptions;

	// SQL processing configuration
	enableViews?: boolean;
	enableSequences?: boolean;
	allowReorderDropComments?: boolean;

	// Default dialect
	defaultDialect?: SqlDialect;
}

export class ServiceContainer {
	#configuration: Required<ServiceConfiguration>;
	#services: Map<string, unknown> = new Map();

	constructor(configuration: ServiceConfiguration = {}) {
		this.#configuration = {
			loggerOptions: {},
			enableViews: true,
			enableSequences: true,
			allowReorderDropComments: false,
			defaultDialect: 'postgresql',
			...configuration,
		};
	}

	/**
	 * Get or create a singleton service instance
	 */
	get<T>(serviceKey: string, factory: () => T): T {
		if (!this.#services.has(serviceKey)) {
			this.#services.set(serviceKey, factory());
		}
		return this.#services.get(serviceKey) as T;
	}

	/**
	 * Get logger instance
	 */
	getLogger(): Logger {
		return this.get(
			'logger',
			() => new Logger(this.#configuration.loggerOptions),
		);
	}

	/**
	 * Get error handler instance
	 */
	getErrorHandler(): ErrorHandler {
		return this.get('errorHandler', () => new ErrorHandler(this.getLogger()));
	}

	/**
	 * Get file system validator instance
	 */
	getFileSystemValidator(): FileSystemValidator {
		return this.get('fileSystemValidator', () => new FileSystemValidator());
	}

	/**
	 * Get dependency analyzer instance
	 */
	getDependencyAnalyzer(): DependencyAnalyzer {
		return this.get(
			'dependencyAnalyzer',
			() => new DependencyAnalyzer(this.getLogger()),
		);
	}

	/**
	 * Get topological sorter instance
	 */
	getTopologicalSorter(): TopologicalSorter {
		return this.get(
			'topologicalSorter',
			() => new TopologicalSorter(this.getLogger()),
		);
	}

	/**
	 * Get SQL file merger instance
	 */
	getSqlFileMerger(): SqlFileMerger {
		return this.get('sqlFileMerger', () => new SqlFileMerger(this.getLogger()));
	}

	/**
	 * Get statement processors based on configuration
	 */
	getStatementProcessors(): StatementProcessor[] {
		return this.get('statementProcessors', () => {
			const processors: StatementProcessor[] = [
				new CreateTableProcessor(), // Always enabled
			];

			if (this.#configuration.enableViews) {
				processors.push(new CreateViewProcessor());
			}

			if (this.#configuration.enableSequences) {
				processors.push(new CreateSequenceProcessor());
			}

			return processors;
		});
	}

	/**
	 * Get SQL file parser instance
	 */
	getSqlFileParser(): SqlFileParser {
		return this.get('sqlFileParser', () => {
			const processors = this.getStatementProcessors();
			return new SqlFileParser(processors);
		});
	}

	/**
	 * Update configuration and clear cached services that depend on it
	 */
	updateConfiguration(newConfiguration: Partial<ServiceConfiguration>): void {
		this.#configuration = { ...this.#configuration, ...newConfiguration };

		// Clear services that depend on configuration
		this.#services.delete('logger');
		this.#services.delete('errorHandler');
		this.#services.delete('statementProcessors');
		this.#services.delete('sqlFileParser');
	}

	/**
	 * Get current configuration
	 */
	getConfiguration(): Readonly<Required<ServiceConfiguration>> {
		return { ...this.#configuration };
	}

	/**
	 * Clear all cached services (useful for testing)
	 */
	clearServices(): void {
		this.#services.clear();
	}

	/**
	 * Create a new container with the same configuration
	 */
	clone(): ServiceContainer {
		return new ServiceContainer(this.#configuration);
	}
}

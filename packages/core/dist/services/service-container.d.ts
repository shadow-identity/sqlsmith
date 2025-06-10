import type { StatementProcessor } from '../processors/base-processor.js';
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
    loggerOptions?: LoggerOptions;
    enableViews?: boolean;
    enableSequences?: boolean;
    allowReorderDropComments?: boolean;
    defaultDialect?: SqlDialect;
}
export declare class ServiceContainer {
    #private;
    constructor(configuration?: ServiceConfiguration);
    /**
     * Get or create a singleton service instance
     */
    get<T>(serviceKey: string, factory: () => T): T;
    /**
     * Get logger instance
     */
    getLogger(): Logger;
    /**
     * Get error handler instance
     */
    getErrorHandler(): ErrorHandler;
    /**
     * Get file system validator instance
     */
    getFileSystemValidator(): FileSystemValidator;
    /**
     * Get dependency analyzer instance
     */
    getDependencyAnalyzer(): DependencyAnalyzer;
    /**
     * Get topological sorter instance
     */
    getTopologicalSorter(): TopologicalSorter;
    /**
     * Get SQL file merger instance
     */
    getSqlFileMerger(): SqlFileMerger;
    /**
     * Get statement processors based on configuration
     */
    getStatementProcessors(): StatementProcessor[];
    /**
     * Get SQL file parser instance
     */
    getSqlFileParser(): SqlFileParser;
    /**
     * Update configuration and clear cached services that depend on it
     */
    updateConfiguration(newConfiguration: Partial<ServiceConfiguration>): void;
    /**
     * Get current configuration
     */
    getConfiguration(): Readonly<Required<ServiceConfiguration>>;
    /**
     * Clear all cached services (useful for testing)
     */
    clearServices(): void;
    /**
     * Create a new container with the same configuration
     */
    clone(): ServiceContainer;
}
//# sourceMappingURL=service-container.d.ts.map
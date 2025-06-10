import { CreateSequenceProcessor } from '../processors/create-sequence-processor.js';
import { CreateTableProcessor } from '../processors/create-table-processor.js';
import { CreateViewProcessor } from '../processors/create-view-processor.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';
import { ErrorHandler } from './error-handler.js';
import { FileSystemValidator } from './file-system-validator.js';
import { Logger } from './logger.js';
import { SqlFileMerger } from './sql-file-merger.js';
import { SqlFileParser } from './sql-file-parser.js';
import { TopologicalSorter } from './topological-sorter.js';
export class ServiceContainer {
    #configuration;
    #services = new Map();
    constructor(configuration = {}) {
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
    get(serviceKey, factory) {
        if (!this.#services.has(serviceKey)) {
            this.#services.set(serviceKey, factory());
        }
        return this.#services.get(serviceKey);
    }
    /**
     * Get logger instance
     */
    getLogger() {
        return this.get('logger', () => new Logger(this.#configuration.loggerOptions));
    }
    /**
     * Get error handler instance
     */
    getErrorHandler() {
        return this.get('errorHandler', () => new ErrorHandler(this.getLogger()));
    }
    /**
     * Get file system validator instance
     */
    getFileSystemValidator() {
        return this.get('fileSystemValidator', () => new FileSystemValidator());
    }
    /**
     * Get dependency analyzer instance
     */
    getDependencyAnalyzer() {
        return this.get('dependencyAnalyzer', () => new DependencyAnalyzer(this.getLogger()));
    }
    /**
     * Get topological sorter instance
     */
    getTopologicalSorter() {
        return this.get('topologicalSorter', () => new TopologicalSorter(this.getLogger()));
    }
    /**
     * Get SQL file merger instance
     */
    getSqlFileMerger() {
        return this.get('sqlFileMerger', () => new SqlFileMerger(this.getLogger()));
    }
    /**
     * Get statement processors based on configuration
     */
    getStatementProcessors() {
        return this.get('statementProcessors', () => {
            const processors = [
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
    getSqlFileParser() {
        return this.get('sqlFileParser', () => {
            const processors = this.getStatementProcessors();
            return new SqlFileParser(processors);
        });
    }
    /**
     * Update configuration and clear cached services that depend on it
     */
    updateConfiguration(newConfiguration) {
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
    getConfiguration() {
        return { ...this.#configuration };
    }
    /**
     * Clear all cached services (useful for testing)
     */
    clearServices() {
        this.#services.clear();
    }
    /**
     * Create a new container with the same configuration
     */
    clone() {
        return new ServiceContainer(this.#configuration);
    }
}
//# sourceMappingURL=service-container.js.map
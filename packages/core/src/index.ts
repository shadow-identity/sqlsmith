// SQLsmith - Main exports

// Processors (for extending functionality)
export type { StatementProcessor } from './processors/base-processor.js';
export { CreateSequenceProcessor } from './processors/create-sequence-processor.js';
export { CreateTableProcessor } from './processors/create-table-processor.js';
export { CreateViewProcessor } from './processors/create-view-processor.js';
// Services (for advanced usage)
export { DependencyAnalyzer } from './services/dependency-analyzer.js';
export { ErrorHandler } from './services/error-handler.js';
export { FileSystemValidator } from './services/file-system-validator.js';
export type { LoggerOptions } from './services/logger.js';
export { Logger } from './services/logger.js';
// Dependency injection
export type { ServiceConfiguration } from './services/service-container.js';
export { ServiceContainer } from './services/service-container.js';
export type { MergeOptions } from './services/sql-file-merger.js';
export { SqlFileMerger } from './services/sql-file-merger.js';
export { SqlFileParser } from './services/sql-file-parser.js';
export { TopologicalSorter } from './services/topological-sorter.js';
// Core functionality
export type { SqlMergerOptions } from './sql-merger.js';
export { SqlMerger } from './sql-merger.js';
// Core types
export type { DependencyGraph } from './types/dependency-graph.js';
// Error handling
export type { ErrorCode } from './types/errors.js';
export {
	ConfigurationError,
	DependencyError,
	FileSystemError,
	ParsingError,
	ProcessingError,
	SqlMergerError,
} from './types/errors.js';
export type {
	Dependency,
	SqlDialect,
	SqlFile,
	SqlStatement,
	StatementType,
} from './types/sql-statement.js';

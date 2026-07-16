// SQLsmith - Main exports

// Processors (for extending functionality)
export type {
	StatementProcessor,
	StatementProcessorContext,
} from './processors/base-processor.js';
export { CreateSequenceProcessor } from './processors/create-sequence-processor.js';
export { CreateTableProcessor } from './processors/create-table-processor.js';
export { CreateViewProcessor } from './processors/create-view-processor.js';
// Intentional public services
export { FileSystemValidator } from './services/file-system-validator.js';
export type { LoggerOptions, LogLevel } from './services/logger.js';
export { Logger } from './services/logger.js';
export type { MergeOptions } from './services/sql-file-merger.js';
export type {
	LexedRelationName,
	RelationNameRole,
	RelationReferenceKind,
	RelationStatementType,
} from './services/sql-identifier-lexer.js';
export { scanRelationNames } from './services/sql-identifier-lexer.js';
export type { SqlStatementChunk } from './services/sql-statement-splitter.js';
export { splitSqlStatements } from './services/sql-statement-splitter.js';
// Core functionality
export type {
	DependencyAnalyzerDependency,
	SqlEmitterDependency,
	SqlFileParserDependency,
	SqlMergerDependencies,
	SqlMergerOptions,
	TopologicalSorterDependency,
} from './sql-merger.js';
export { SqlMerger } from './sql-merger.js';
// Core types
export type { DependencyGraph } from './types/dependency-graph.js';
// Error handling
export {
	ConfigurationError,
	DependencyError,
	ErrorCode,
	FileSystemError,
	ParsingError,
	ProcessingError,
	SqlMergerError,
} from './types/errors.js';
export type {
	DiscoveryOptions,
	MergeDiagnostic,
	MergePlan,
} from './types/merge-plan.js';
export type {
	IdentifierPart,
	IdentifierRules,
	RelationIdentifier,
	RelationKey,
	SourceIdentifierPart,
	SourceRelationName,
} from './types/relation-identifier.js';
export {
	createIdentifierRules,
	createRelationIdentifier,
	unquotedRelationName,
} from './types/relation-identifier.js';
export type {
	Dependency,
	SqlDialect,
	SqlFile,
	SqlStatement,
	StatementType,
} from './types/sql-statement.js';

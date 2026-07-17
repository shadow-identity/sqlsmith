// SQLsmith - Main exports

// Processors (for extending functionality)
export { AlterTableProcessor } from './processors/alter-table-processor.js';
export type {
	StatementProcessor,
	StatementProcessorContext,
} from './processors/base-processor.js';
export { CreateIndexProcessor } from './processors/create-index-processor.js';
export { CreateSequenceProcessor } from './processors/create-sequence-processor.js';
export { CreateTableProcessor } from './processors/create-table-processor.js';
export { CreateViewProcessor } from './processors/create-view-processor.js';
export type {
	AstIndexDeclaration,
	AstRelationName,
	AstRelationStatementType,
	DialectAstAdapter,
	DialectFromItem,
} from './services/dialect-ast-adapter.js';
export { getDialectAstAdapter } from './services/dialect-ast-adapter.js';
// Intentional public services
export { FileSystemValidator } from './services/file-system-validator.js';
export type { LoggerOptions, LogLevel } from './services/logger.js';
export { Logger } from './services/logger.js';
export {
	renderDependencyGraph,
	renderDiagnostic,
	renderDiagnostics,
	renderDiscoveredFiles,
	renderRecommendedOrder,
	renderValidationSummary,
} from './services/plan-renderers.js';
export type {
	SelectRelationCollection,
	SelectRelationCollectorOptions,
} from './services/select-relation-collector.js';
export { collectSelectRelations } from './services/select-relation-collector.js';
export type { MergeOptions } from './services/sql-file-merger.js';
export type {
	LexedRelationName,
	RelationNameRole,
	RelationReferenceKind,
	RelationStatementType,
} from './services/sql-identifier-lexer.js';
export {
	scanCteAliases,
	scanRelationNames,
} from './services/sql-identifier-lexer.js';
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
export type {
	DialectCapabilities,
	IdentifierCaseFolding,
	SequenceSemantics,
	SqlDialect,
} from './types/dialect.js';
export {
	DIALECT_CAPABILITIES,
	isSupportedDialect,
	SUPPORTED_DIALECTS,
} from './types/dialect.js';
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
	MergeDiagnosticSeverity,
	MergePlan,
} from './types/merge-plan.js';
export type {
	DialectRules,
	IdentifierNamespace,
	IdentifierPart,
	RelationIdentifier,
	RelationKey,
	SourceIdentifierPart,
	SourceRelationName,
} from './types/relation-identifier.js';
export {
	createDialectRules,
	createRelationIdentifier,
	createSecondaryIdentifier,
	unquotedRelationName,
} from './types/relation-identifier.js';
export type {
	Dependency,
	SqlFile,
	SqlStatement,
	StatementType,
} from './types/sql-statement.js';

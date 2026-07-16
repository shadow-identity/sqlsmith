import type { DependencyGraph } from './dependency-graph.js';
import type { SqlFile, SqlStatement } from './sql-statement.js';

export interface DiscoveryOptions {
	recursive?: boolean;
	exclude?: readonly string[];
}

export type MergeDiagnostic =
	| {
			readonly code: 'EXTERNAL_REFERENCE';
			readonly message: string;
			readonly statementName: string;
			readonly dependencyName: string;
	  }
	| {
			readonly code: 'RAW_STATEMENTS';
			readonly message: string;
			readonly count: number;
			readonly statements: readonly string[];
	  }
	| {
			readonly code: 'RAW_ONLY_FILE';
			readonly message: string;
			readonly count: number;
			readonly statements: readonly string[];
	  };

export interface DependencyAnalysis {
	readonly graph: DependencyGraph<string>;
	readonly diagnostics: readonly MergeDiagnostic[];
}

export interface MergePlan {
	readonly files: readonly SqlFile[];
	/** Statements understood by registered processors and represented in graph. */
	readonly statements: readonly SqlStatement[];
	readonly graph: DependencyGraph<string>;
	/** Final emission order, including raw passthrough statements. */
	readonly orderedStatements: readonly SqlStatement[];
	readonly diagnostics: readonly MergeDiagnostic[];
}

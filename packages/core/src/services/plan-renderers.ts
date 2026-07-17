import type { MergeDiagnostic, MergePlan } from '../types/merge-plan.js';
import type { RelationKey } from '../types/relation-identifier.js';
import type { Logger } from './logger.js';

export const renderDiagnostic = (
	logger: Logger,
	diagnostic: MergeDiagnostic,
): void => {
	const write = diagnostic.severity === 'info' ? logger.info : logger.warn;
	switch (diagnostic.code) {
		case 'RAW_STATEMENTS':
			write(`${diagnostic.message}: ${diagnostic.statements.join(', ')}`);
			break;
		default:
			write(diagnostic.message);
			break;
	}
};

export const renderDiagnostics = (logger: Logger, plan: MergePlan): void => {
	for (const diagnostic of plan.diagnostics) {
		renderDiagnostic(logger, diagnostic);
	}
};

export const renderDiscoveredFiles = (
	logger: Logger,
	plan: MergePlan,
): void => {
	logger.debug(`Discovered ${plan.files.length} SQL file(s):`);
	for (const file of plan.files) {
		logger.debug(`  ${file.path} (${file.statements.length} statement(s))`);
	}
};

export const renderDependencyGraph = (
	logger: Logger,
	plan: MergePlan,
): void => {
	const statementMap = new Map(
		plan.statements.flatMap((statement) =>
			statement.identifier
				? [[statement.identifier.key, statement] as const]
				: [],
		),
	);
	const display = (key: RelationKey): string =>
		statementMap.get(key)?.identifier?.display ?? key;
	logger.header('🔗 Dependency Graph');

	for (const node of plan.graph.nodes) {
		const statement = statementMap.get(node);
		const dependencies = plan.graph.edges.get(node) ?? new Set<RelationKey>();
		const dependents =
			plan.graph.reversedEdges.get(node) ?? new Set<RelationKey>();
		const nonSelfDependencies = [...dependencies].filter(
			(dependency) => dependency !== node,
		);
		const nonSelfDependents = [...dependents].filter(
			(dependent) => dependent !== node,
		);

		logger.info(
			`📊 ${statement?.type.toUpperCase() ?? 'UNKNOWN'}: ${display(node)}`,
		);
		logger.info(
			`  ➡️  Depends on: ${nonSelfDependencies.map(display).join(', ') || '(none)'}`,
		);
		if (dependencies.has(node)) {
			logger.info(
				`  🔄 Self-referencing: ${display(node)} (hierarchical structure)`,
			);
		}
		if (dependents.size > 0) {
			logger.info(
				`  ⬅️  Referenced by: ${nonSelfDependents.map(display).join(', ') || '(none)'}`,
			);
		}
		logger.raw('');
	}

	logger.success('No circular dependencies detected');
	logger.raw('');
};

export const renderRecommendedOrder = (
	logger: Logger,
	plan: MergePlan,
): void => {
	logger.info('📋 Recommended execution order:');
	plan.orderedStatements.forEach((statement, index) => {
		const fileName = statement.filePath.split('/').pop();
		const statementDisplay = statement.identifier?.display ?? statement.name;
		const dependencies =
			statement.dependsOn.length > 0
				? ` (depends on: ${statement.dependsOn
						.map((item) => item.identifier.display)
						.join(', ')})`
				: ' (no dependencies)';
		logger.info(
			`  ${index + 1}. ${fileName} - ${statement.type}:${statementDisplay}${dependencies}`,
		);
	});
};

export const renderValidationSummary = (
	logger: Logger,
	plan: MergePlan,
): void => {
	for (const file of plan.files) {
		const fileName = file.path.split('/').pop() || file.path;
		if (file.statements.length === 0) {
			logger.warn(`${fileName} - no statements found`);
			continue;
		}
		logger.success(
			`${fileName} - ${file.statements
				.map(
					(statement) =>
						`${statement.type}:${statement.identifier?.display ?? statement.name}`,
				)
				.join(', ')}`,
		);
	}

	const statementCount = plan.files.reduce(
		(total, file) => total + file.statements.length,
		0,
	);
	logger.info(
		`\n📊 Total: ${plan.files.length} files, ${statementCount} statements`,
	);
	logger.success('No circular dependencies detected');
	logger.success('Ready for merging');
};

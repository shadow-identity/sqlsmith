import type { Logger, MergePlan } from '@sqlsmith/core';

export const renderDiagnostics = (logger: Logger, plan: MergePlan): void => {
	for (const diagnostic of plan.diagnostics) {
		switch (diagnostic.code) {
			case 'EXTERNAL_REFERENCE':
				logger.warn(diagnostic.message);
				break;
			case 'RAW_STATEMENTS':
				logger.warn(
					`${diagnostic.message}: ${diagnostic.statements.join(', ')}`,
				);
				break;
			case 'RAW_ONLY_FILE':
				logger.warn(diagnostic.message);
				break;
		}
	}
};

export const renderDependencyGraph = (
	logger: Logger,
	plan: MergePlan,
): void => {
	const statementMap = new Map(
		plan.statements.map((statement) => [statement.name, statement]),
	);
	logger.header('🔗 Dependency Graph');

	for (const node of plan.graph.nodes) {
		const statement = statementMap.get(node);
		const dependencies = plan.graph.edges.get(node) ?? new Set<string>();
		const dependents = plan.graph.reversedEdges.get(node) ?? new Set<string>();
		const nonSelfDependencies = [...dependencies].filter(
			(dependency) => dependency !== node,
		);
		const nonSelfDependents = [...dependents].filter(
			(dependent) => dependent !== node,
		);

		logger.info(`📊 ${statement?.type.toUpperCase() ?? 'UNKNOWN'}: ${node}`);
		logger.info(
			`  ➡️  Depends on: ${nonSelfDependencies.join(', ') || '(none)'}`,
		);
		if (dependencies.has(node)) {
			logger.info(`  🔄 Self-referencing: ${node} (hierarchical structure)`);
		}
		if (dependents.size > 0) {
			logger.info(
				`  ⬅️  Referenced by: ${nonSelfDependents.join(', ') || '(none)'}`,
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
		const dependencies =
			statement.dependsOn.length > 0
				? ` (depends on: ${statement.dependsOn.map((item) => item.name).join(', ')})`
				: ' (no dependencies)';
		logger.info(
			`  ${index + 1}. ${fileName} - ${statement.type}:${statement.name}${dependencies}`,
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
				.map((statement) => `${statement.type}:${statement.name}`)
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

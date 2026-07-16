import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DependencyAnalyzer } from '../src/services/dependency-analyzer.js';
import type { Logger } from '../src/services/logger.js';
import { SqlMerger } from '../src/sql-merger.js';
import { DependencyError, ErrorCode } from '../src/types/errors.js';
import {
	createIdentifierRules,
	createRelationIdentifier,
	unquotedRelationName,
} from '../src/types/relation-identifier.js';
import type { SqlFile } from '../src/types/sql-statement.js';

// C4-SINGLE-PLAN / C4-CYCLE / C4-PRESENTATION / R4-02 / R4-03 / R4-04

const fixture = (scenario: string): string =>
	resolve(process.cwd(), `test/fixtures/postgresql/${scenario}`);

const relation = (name: string) =>
	createRelationIdentifier(
		unquotedRelationName(name),
		createIdentifierRules('postgresql'),
	);

const silentLogger = (): Logger =>
	({
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		success: vi.fn(),
		header: vi.fn(),
		raw: vi.fn(),
	}) as unknown as Logger;

describe('MergePlan contract', () => {
	it('builds one graph and merge only emits the existing plan', () => {
		const logger = silentLogger();
		const analyzer = new DependencyAnalyzer();
		const buildGraph = vi.spyOn(analyzer, 'buildStatementGraph');
		const merger = new SqlMerger({ logger }, { dependencyAnalyzer: analyzer });

		const plan = merger.planDirectory(
			fixture('correct/interleaved_dependencies'),
			'postgresql',
		);

		expect(plan.files).toHaveLength(2);
		expect(plan.statements.map((statement) => statement.name)).toEqual([
			'x',
			'z',
			'y',
		]);
		expect([...plan.graph.nodes]).toEqual(
			expect.arrayContaining([
				relation('x').key,
				relation('y').key,
				relation('z').key,
			]),
		);
		expect(plan.orderedStatements.map((statement) => statement.name)).toEqual([
			'x',
			'y',
			'z',
		]);
		expect(plan.diagnostics).toEqual([]);
		expect(buildGraph).toHaveBeenCalledTimes(1);

		const merged = merger.merge(plan, {
			addComments: false,
			includeHeader: false,
		});

		expect(merged.indexOf('CREATE TABLE x')).toBeLessThan(
			merged.indexOf('CREATE TABLE y'),
		);
		expect(merged.indexOf('CREATE TABLE y')).toBeLessThan(
			merged.indexOf('CREATE TABLE z'),
		);
		expect(buildGraph).toHaveBeenCalledTimes(1);
	});

	it('reports external references and raw passthrough as structured data', () => {
		const externalPlan = new SqlMerger({
			allowExternalReferences: true,
			logger: silentLogger(),
		}).planDirectory(fixture('invalid/missing_dependency'), 'postgresql');
		const rawPlan = new SqlMerger({ logger: silentLogger() }).planDirectory(
			fixture('correct/raw_statements'),
			'postgresql',
		);

		expect(externalPlan.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'EXTERNAL_REFERENCE',
					statementName: 'orders',
					dependencyName: 'customers',
				}),
			]),
		);
		expect(rawPlan.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'RAW_STATEMENTS', count: 4 }),
			]),
		);
	});

	it('uses the typed cycle boundary for directory and in-memory plans', () => {
		const merger = new SqlMerger({
			validateSourceOrder: false,
			logger: silentLogger(),
		});
		const cyclicFiles: SqlFile[] = [
			{
				path: '/virtual/a.sql',
				content: '',
				statements: [
					{
						type: 'table',
						identifier: relation('a'),
						name: 'a',
						dependsOn: [
							{ identifier: relation('b'), name: 'b', type: 'table' },
						],
						filePath: '/virtual/a.sql',
						content: 'CREATE TABLE a (b_id integer);',
					},
				],
			},
			{
				path: '/virtual/b.sql',
				content: '',
				statements: [
					{
						type: 'table',
						identifier: relation('b'),
						name: 'b',
						dependsOn: [
							{ identifier: relation('a'), name: 'a', type: 'table' },
						],
						filePath: '/virtual/b.sql',
						content: 'CREATE TABLE b (a_id integer);',
					},
				],
			},
		];

		for (const makePlan of [
			() =>
				merger.planDirectory(
					fixture('invalid/circular_dependency'),
					'postgresql',
				),
			() => merger.planFiles(cyclicFiles),
		]) {
			try {
				makePlan();
				expect.unreachable('planning should reject a dependency cycle');
			} catch (error) {
				expect(error).toBeInstanceOf(DependencyError);
				expect(error).toMatchObject({ code: ErrorCode.CIRCULAR_DEPENDENCY });
			}
		}
	});

	it('does not print presentation while retaining plan data', () => {
		const logger = silentLogger();
		const plan = new SqlMerger({ logger }).planDirectory(
			fixture('correct/single_foreign_keys'),
			'postgresql',
		);

		expect(plan.graph.nodes.size).toBeGreaterThan(0);
		expect(plan.orderedStatements.length).toBeGreaterThan(0);
		expect(logger.header).not.toHaveBeenCalled();
		expect(logger.info).not.toHaveBeenCalled();
		expect(logger.success).not.toHaveBeenCalled();
		expect(logger.raw).not.toHaveBeenCalled();
	});

	it('preserves the representative golden output', () => {
		const scenario = fixture('correct/interleaved_dependencies');
		const merger = new SqlMerger({ logger: silentLogger() });
		const plan = merger.planDirectory(scenario, 'postgresql');
		const merged = merger.merge(plan, {
			addComments: false,
			includeHeader: false,
		});
		const golden = readFileSync(
			fixture('correct/interleaved_dependencies.expected.sql'),
			'utf8',
		);

		expect(merged.replace(/\s+/g, ' ').trim()).toBe(
			golden.replace(/\s+/g, ' ').trim(),
		);
	});
});

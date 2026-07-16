import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SqlStatement } from '../src/index.js';
import * as publicApi from '../src/index.js';
import { ErrorCode, ProcessingError, SqlMerger } from '../src/index.js';

// C6B-NESTED / C6B-CTE / C6B-RELATION / C6B-UNKNOWN
// R6B-01 / R6B-02 / R6B-03 / R6B-04

const temporaryDirectories: string[] = [];
const relationKey = (schema: string, name: string): string =>
	JSON.stringify(['relation', schema, name]);

async function createSqlDirectory(
	files: Record<string, string>,
): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'sql-merger-views-'));
	temporaryDirectories.push(directory);
	await Promise.all(
		Object.entries(files).map(([name, content]) =>
			writeFile(join(directory, name), content, 'utf8'),
		),
	);
	return directory;
}

const dependencyKeys = (statement: {
	dependsOn: ReadonlyArray<{ identifier: { key: string } }>;
}): string[] => statement.dependsOn.map(({ identifier }) => identifier.key);

const statementByKey = (
	statements: readonly SqlStatement[],
	key: string,
): SqlStatement => {
	const statement = statements.find(
		(candidate) => candidate.identifier?.key === key,
	);
	if (!statement) throw new Error(`Expected statement ${key}`);
	return statement;
};

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe('complete view dependency contract', () => {
	it('collects JOIN, derived-table, scalar, and EXISTS subquery relations with source quoting', async () => {
		const directory = await createSqlDirectory({
			'00_users.sql': 'CREATE TABLE public.users (id int PRIMARY KEY);',
			'01_orders.sql': 'CREATE TABLE sales.orders (id int, user_id int);',
			'02_invoices.sql':
				'CREATE TABLE "billing.one"."Invoices" (id int, user_id int);',
			'03_sessions.sql': 'CREATE TABLE auth.sessions (id int, user_id int);',
			'10_report.sql': `CREATE VIEW audit.report AS
SELECT d.id,
       (SELECT count(*) FROM "billing.one"."Invoices" i WHERE i.user_id = d.id) AS invoice_count
FROM (
    SELECT u.id
    FROM public.users u
    WHERE EXISTS (SELECT 1 FROM auth.sessions s WHERE s.user_id = u.id)
) d
JOIN sales.orders o ON o.user_id = d.id;`,
		});
		const merger = new SqlMerger();
		const plan = merger.planDirectory(directory);
		const view = statementByKey(
			plan.statements,
			relationKey('audit', 'report'),
		);

		expect(dependencyKeys(view)).toEqual([
			relationKey('billing.one', 'Invoices'),
			relationKey('public', 'users'),
			relationKey('auth', 'sessions'),
			relationKey('sales', 'orders'),
		]);
		expect(view.dependsOn[0]?.identifier.display).toBe(
			'"billing.one"."Invoices"',
		);
		const order = plan.orderedStatements.map(
			(statement) => statement.identifier?.key,
		);
		for (const dependency of dependencyKeys(view)) {
			expect(order.indexOf(dependency)).toBeLessThan(
				order.indexOf(relationKey('audit', 'report')),
			);
		}
		expect(
			merger.merge(plan, { addComments: false, includeHeader: false }),
		).toContain('FROM "billing.one"."Invoices"');
	});

	it('scopes chained and recursive CTE aliases while retaining underlying relations', async () => {
		const directory = await createSqlDirectory({
			'00_users.sql': 'CREATE TABLE public.users (id int PRIMARY KEY);',
			'01_orders.sql': 'CREATE TABLE sales.orders (id int PRIMARY KEY);',
			'02_nodes.sql': 'CREATE TABLE public.nodes (id int PRIMARY KEY);',
			'10_cte.sql': `CREATE VIEW audit.cte_report AS
WITH base AS (
    SELECT * FROM public.users
), enriched AS (
    SELECT b.id FROM base b JOIN sales.orders o ON true
)
SELECT * FROM enriched;`,
			'11_recursive.sql': `CREATE VIEW audit.tree AS
WITH RECURSIVE tree AS (
    SELECT * FROM public.nodes
    UNION ALL (SELECT n.* FROM public.nodes n JOIN tree t ON true)
)
SELECT * FROM tree;`,
			'12_quoted.sql': `CREATE VIEW audit.quoted_cte AS
WITH "Base" AS (
    SELECT * FROM public.users
)
SELECT * FROM "Base";`,
		});
		const plan = new SqlMerger().planDirectory(directory);
		const cteView = statementByKey(
			plan.statements,
			relationKey('audit', 'cte_report'),
		);
		const recursiveView = statementByKey(
			plan.statements,
			relationKey('audit', 'tree'),
		);
		const quotedView = statementByKey(
			plan.statements,
			relationKey('audit', 'quoted_cte'),
		);

		expect(dependencyKeys(cteView)).toEqual([
			relationKey('public', 'users'),
			relationKey('sales', 'orders'),
		]);
		expect(dependencyKeys(recursiveView)).toEqual([
			relationKey('public', 'nodes'),
		]);
		expect(dependencyKeys(quotedView)).toEqual([
			relationKey('public', 'users'),
		]);
		expect(plan.graph.nodes).not.toContain(relationKey('public', 'base'));
		expect(plan.graph.nodes).not.toContain(relationKey('public', 'enriched'));
		expect(plan.graph.nodes).not.toContain(relationKey('public', 'tree'));
	});

	it('sorts view-to-view chains and deduplicates UNION branch references', async () => {
		const directory = await createSqlDirectory({
			'00_public_users.sql': 'CREATE TABLE public.users (id int PRIMARY KEY);',
			'01_audit_users.sql': 'CREATE TABLE audit.users (id int PRIMARY KEY);',
			'10_base_view.sql':
				'CREATE VIEW audit.base_users AS SELECT id FROM public.users;',
			'20_all_view.sql': `CREATE VIEW audit.all_users AS
SELECT b.id FROM audit.base_users b JOIN public.users u ON u.id = b.id
UNION ALL (SELECT id FROM audit.users)
UNION (SELECT id FROM public.users);`,
		});
		const plan = new SqlMerger().planDirectory(directory);
		const dependentView = statementByKey(
			plan.statements,
			relationKey('audit', 'all_users'),
		);

		expect(dependencyKeys(dependentView)).toEqual([
			relationKey('audit', 'base_users'),
			relationKey('public', 'users'),
			relationKey('audit', 'users'),
		]);
		const order = plan.orderedStatements.map(
			(statement) => statement.identifier?.key,
		);
		expect(order.indexOf(relationKey('public', 'users'))).toBeLessThan(
			order.indexOf(relationKey('audit', 'base_users')),
		);
		expect(order.indexOf(relationKey('audit', 'base_users'))).toBeLessThan(
			order.indexOf(relationKey('audit', 'all_users')),
		);
	});

	it('rejects an unknown relation-bearing SELECT shape at the public collector boundary', () => {
		const collectSelectRelations = Reflect.get(
			publicApi,
			'collectSelectRelations',
		) as ((select: unknown, options: unknown) => unknown) | undefined;
		expect(collectSelectRelations).toBeTypeOf('function');

		try {
			collectSelectRelations?.(
				{
					type: 'select',
					with: null,
					from: [
						{
							type: 'future_relation',
							relation: { db: 'public', table: 'users' },
						},
					],
					columns: [],
				},
				{
					identifierRules: publicApi.createIdentifierRules('postgresql'),
				},
			);
			expect.unreachable('Unknown SELECT relation shape must be rejected');
		} catch (error) {
			expect(error).toBeInstanceOf(ProcessingError);
			expect(error).toMatchObject({
				code: ErrorCode.PROCESSOR_ERROR,
				context: {
					processorName: 'SelectRelationCollector',
					path: 'select.from[0]',
					shape: 'future_relation',
				},
			});
		}
	});
});

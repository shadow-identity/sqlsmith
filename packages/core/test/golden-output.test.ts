import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_DIALECTS } from '../src/index.js';
import { SqlMerger } from '../src/sql-merger.js';
import { ErrorCode } from '../src/types/errors.js';

// C3-REGRESSION / C4-GOLDEN / C6C-GOLDEN / R3-06 / R4-06 / R6C-03

/**
 * Golden-file contract: for every correct scenario with a
 * `<scenario>.expected.sql` next to it, the merged output must contain
 * exactly the statements of the golden file in exactly the golden order.
 *
 * Comparison ignores comments and whitespace so the goldens pin down
 * content and order, not formatting.
 */
const normalizeSql = (sql: string): string =>
	sql
		.split('\n')
		.map((line) => {
			const commentStart = line.indexOf('--');
			return commentStart >= 0 ? line.slice(0, commentStart) : line;
		})
		.join('\n')
		.replace(/\s+/g, ' ')
		.trim();

describe('golden output', () => {
	SUPPORTED_DIALECTS.forEach((dialect) => {
		describe(`${dialect} dialect`, () => {
			const correctDir = resolve(
				process.cwd(),
				`test/fixtures/${dialect}/correct`,
			);
			const scenarios = readdirSync(correctDir)
				.filter((entry) => statSync(resolve(correctDir, entry)).isDirectory())
				.filter((entry) =>
					existsSync(resolve(correctDir, `${entry}.expected.sql`)),
				)
				.sort();

			scenarios.forEach((scenario) => {
				it(`produces the golden output for ${scenario}`, () => {
					const merger = new SqlMerger();
					const plan = merger.planDirectory(
						resolve(correctDir, scenario),
						dialect,
					);
					const merged = merger.merge(plan, {
						addComments: false,
						includeHeader: false,
					});

					const golden = readFileSync(
						resolve(correctDir, `${scenario}.expected.sql`),
						'utf-8',
					);

					expect(normalizeSql(merged)).toBe(normalizeSql(golden));
				});
			});

			it('covers base table, FK and view dependency ordering', () => {
				const merger = new SqlMerger();
				const plan = merger.planDirectory(
					resolve(correctDir, 'dialect_contract'),
					dialect,
				);
				const ordered = plan.orderedStatements.map(
					(statement) => statement.identifier?.name.canonical,
				);

				expect(plan.statements.map(({ type }) => type)).toEqual(
					expect.arrayContaining(['table', 'table', 'view']),
				);
				expect(ordered).toEqual(['users', 'orders', 'user_orders']);
			});

			it.each([
				['duplicate_table_names', ErrorCode.DUPLICATE_STATEMENT_NAMES],
				['missing_dependency', ErrorCode.MISSING_DEPENDENCY],
			] as const)('covers invalid fixture %s', (scenario, code) => {
				expect(() =>
					new SqlMerger().planDirectory(
						resolve(
							process.cwd(),
							`test/fixtures/${dialect}/invalid/${scenario}`,
						),
						dialect,
					),
				).toThrowError(expect.objectContaining({ code }));
			});
		});
	});
});

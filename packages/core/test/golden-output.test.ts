import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type SqlDialect, SqlMerger } from '../src/sql-merger.js';

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
	const dialects: SqlDialect[] = ['postgresql', 'sqlite'];

	dialects.forEach((dialect) => {
		describe(`${dialect} dialect`, () => {
			const correctDir = resolve(
				process.cwd(),
				`test/fixtures/${dialect}/correct`,
			);
			if (!existsSync(correctDir)) {
				return;
			}

			const scenarios = readdirSync(correctDir)
				.filter((entry) => statSync(resolve(correctDir, entry)).isDirectory())
				.filter((entry) =>
					existsSync(resolve(correctDir, `${entry}.expected.sql`)),
				)
				.sort();

			scenarios.forEach((scenario) => {
				it(`produces the golden output for ${scenario}`, () => {
					const merger = new SqlMerger();
					const files = merger.parseSqlFiles(
						resolve(correctDir, scenario),
						dialect,
					);
					const merged = merger.mergeFiles(files, {
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
		});
	});
});

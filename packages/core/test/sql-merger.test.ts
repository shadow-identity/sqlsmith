import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type SqlDialect, SqlMerger } from '../src/sql-merger.js';
import {
	DependencyError,
	ErrorCode,
	FileSystemError,
} from '../src/types/errors.js';

describe('SqlMerger public pipeline', () => {
	const dialects: SqlDialect[] = ['postgresql', 'sqlite'];
	const fixture = (dialect: SqlDialect, scenario: string): string =>
		resolve(process.cwd(), `test/fixtures/${dialect}/${scenario}`);
	const scenarios = (
		dialect: SqlDialect,
		type: 'correct' | 'invalid',
	): string[] => {
		const directory = fixture(dialect, type);
		if (!existsSync(directory)) return [];
		return readdirSync(directory)
			.filter((entry) => statSync(resolve(directory, entry)).isDirectory())
			.sort();
	};

	describe.each(dialects)('%s fixtures', (dialect) => {
		it.each(scenarios(dialect, 'correct'))(
			'plans and merges %s through one pipeline',
			(scenario) => {
				const merger = new SqlMerger();
				const plan = merger.planDirectory(
					fixture(dialect, `correct/${scenario}`),
					dialect,
				);
				const merged = merger.merge(plan);

				expect(plan.files.length).toBeGreaterThan(0);
				expect(plan.statements.length).toBeGreaterThan(0);
				expect(plan.graph.nodes.size).toBe(plan.statements.length);
				expect(merged).toContain('CREATE TABLE');
			},
		);

		it.each(scenarios(dialect, 'invalid'))(
			'rejects invalid scenario %s with its documented message',
			(scenario) => {
				const merger = new SqlMerger();
				const scenarioPath = fixture(dialect, `invalid/${scenario}`);
				const expectedPath = resolve(
					scenarioPath,
					'..',
					`${scenario}.expected.json`,
				);
				const messagePattern = existsSync(expectedPath)
					? new RegExp(
							JSON.parse(readFileSync(expectedPath, 'utf8')).messagePattern,
						)
					: undefined;

				expect(() => merger.planDirectory(scenarioPath, dialect)).toThrow(
					messagePattern,
				);
			},
		);

		it('parses a single file independently', () => {
			const path = resolve(
				fixture(dialect, 'invalid/circular_dependency'),
				'foo.sql',
			);
			const file = new SqlMerger().parseSingleFile(path, dialect);

			expect(file.path).toBe(path);
			expect(file.statements[0]).toMatchObject({ name: 'foo', type: 'table' });
		});
	});

	it('supports processor feature options through the ordinary constructor', () => {
		const tableOnly = new SqlMerger({
			enableViews: false,
			enableSequences: false,
		});
		const tableAndView = new SqlMerger({
			enableViews: true,
			enableSequences: false,
		});

		expect(tableOnly.getSupportedTypes()).toEqual(['table']);
		expect(tableAndView.getSupportedTypes()).toEqual(['table', 'view']);
	});

	it('emits with comments/header options and handles an empty in-memory plan', () => {
		const merger = new SqlMerger();
		const plan = merger.planDirectory(
			fixture('postgresql', 'correct/base_tables'),
			'postgresql',
		);

		expect(merger.merge(plan)).toContain('SQLsmith Output');
		expect(
			merger.merge(plan, { addComments: false, includeHeader: false }),
		).not.toContain('SQLsmith Output');
		expect(merger.merge(merger.planFiles([]))).toBe('');
	});

	it('returns typed filesystem context for a missing directory', () => {
		const path = '/absolutely/non/existent/path';
		try {
			new SqlMerger().planDirectory(path, 'postgresql');
			expect.unreachable('planning should reject a missing directory');
		} catch (error) {
			expect(error).toBeInstanceOf(FileSystemError);
			expect(error).toMatchObject({
				code: ErrorCode.DIRECTORY_NOT_FOUND,
				context: { path },
			});
		}
	});

	it('returns DependencyError for duplicate names and cycles', () => {
		const merger = new SqlMerger();
		for (const scenario of [
			'invalid/duplicate_table_names',
			'invalid/circular_dependency',
		]) {
			expect(() =>
				merger.planDirectory(fixture('postgresql', scenario), 'postgresql'),
			).toThrow(DependencyError);
		}
	});
});

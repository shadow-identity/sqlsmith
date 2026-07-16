import { describe, expect, it } from 'vitest';
import * as publicApi from '../src/index.js';
import type { StatementProcessor } from '../src/processors/base-processor.js';
import { SqlMerger, type SqlMergerDependencies } from '../src/sql-merger.js';
import type { SqlFile } from '../src/types/sql-statement.js';

// C4-CONSTRUCTOR / R4-01 / R4-07

describe('public construction contract', () => {
	it('does not expose the removed service-locator API', () => {
		expect(publicApi).not.toHaveProperty('ServiceContainer');
		expect(SqlMerger).not.toHaveProperty('withContainer');
	});

	it('accepts narrow typed dependencies without a container', () => {
		const file: SqlFile = {
			path: '/virtual/schema.sql',
			content: 'CREATE TABLE users (id integer);',
			statements: [
				{
					type: 'table',
					name: 'users',
					dependsOn: [],
					filePath: '/virtual/schema.sql',
					content: 'CREATE TABLE users (id integer);',
					orderInFile: 0,
				},
			],
		};
		const dependencies: SqlMergerDependencies = {
			fileParser: {
				parseDirectory: () => [file],
				parseFile: () => file,
				getSupportedTypes: () => ['table'],
			},
		};

		const merger = new SqlMerger({}, dependencies);
		const plan = merger.planDirectory('/virtual', 'postgresql');

		expect(plan.files).toEqual([file]);
		expect(merger.getSupportedTypes()).toEqual(['table']);
	});

	it('keeps custom processors as an intentional extension point', () => {
		const processor: StatementProcessor = {
			getHandledTypes: () => ['custom'],
			canProcess: () => false,
			extractStatements: () => [],
		};

		const merger = new SqlMerger({ processors: [processor] });

		expect(merger.getSupportedTypes()).toContain('custom');
	});
});

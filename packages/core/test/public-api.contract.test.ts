import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../src/index.js';
import type { StatementProcessor } from '../src/processors/base-processor.js';
import { FileSystemValidator } from '../src/services/file-system-validator.js';
import { SqlMerger, type SqlMergerDependencies } from '../src/sql-merger.js';
import { SUPPORTED_DIALECTS } from '../src/types/dialect.js';
import {
	createDialectRules,
	createRelationIdentifier,
	unquotedRelationName,
} from '../src/types/relation-identifier.js';
import type { SqlFile } from '../src/types/sql-statement.js';

// C4-CONSTRUCTOR / C6C-REGISTRY / R4-01 / R4-07 / R6C-02

describe('public construction contract', () => {
	it('does not expose the removed service-locator API', () => {
		expect(publicApi).not.toHaveProperty('ServiceContainer');
		expect(SqlMerger).not.toHaveProperty('withContainer');
	});

	it('accepts narrow typed dependencies without a container', () => {
		const identifier = createRelationIdentifier(
			unquotedRelationName('users'),
			createDialectRules('postgresql'),
		);
		const file: SqlFile = {
			path: '/virtual/schema.sql',
			content: 'CREATE TABLE users (id integer);',
			statements: [
				{
					type: 'table',
					identifier,
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

	it('uses one exported registry for the runtime API and validation', () => {
		expect(SUPPORTED_DIALECTS).toEqual(['postgresql', 'sqlite', 'mysql']);
		expect(publicApi.SUPPORTED_DIALECTS).toBe(SUPPORTED_DIALECTS);

		const validator = new FileSystemValidator();
		for (const dialect of SUPPORTED_DIALECTS) {
			expect(() => validator.validateDialect(dialect)).not.toThrow();
		}
		expect(() => validator.validateDialect('bigquery')).toThrow();
	});

	it.each(['../../README.md', 'README.md'])(
		'keeps the documented capability rows aligned in %s',
		(readme) => {
			const content = readFileSync(resolve(process.cwd(), readme), 'utf8');
			const matrix = content.match(
				/<!-- dialect-capabilities:start -->([\s\S]*?)<!-- dialect-capabilities:end -->/u,
			)?.[1];
			const documented = [
				...(matrix ?? '').matchAll(/^\| `([^`]+)` \|/gmu),
			].map(([, dialect]) => dialect);

			expect(documented).toEqual(SUPPORTED_DIALECTS);
		},
	);
});

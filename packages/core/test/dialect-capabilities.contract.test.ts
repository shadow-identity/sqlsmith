import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Parser } from 'node-sql-parser';
import { describe, expect, it } from 'vitest';
import {
	createDialectRules,
	DIALECT_CAPABILITIES,
	getDialectAstAdapter,
	type SqlDialect,
	SUPPORTED_DIALECTS,
	scanRelationNames,
} from '../src/index.js';

// C6C-CAPABILITY / C6C-ADAPTER / R6C-01 / R6C-04

const parser = new Parser();

const parse = (sql: string, dialect: SqlDialect): unknown => {
	const { ast } = parser.parse(sql, { database: dialect });
	return Array.isArray(ast) ? ast[0] : ast;
};

describe('dialect capability contracts', () => {
	it('publishes an explicit, complete capability matrix', () => {
		expect(DIALECT_CAPABILITIES).toEqual({
			postgresql: {
				quoteSyntax: ['"'],
				caseFolding: 'lowercase-unquoted',
				defaultNamespace: 'public',
				createTable: true,
				foreignKeys: true,
				views: true,
				sequenceSemantics: 'create-sequence',
			},
			sqlite: {
				quoteSyntax: ['"', '`'],
				caseFolding: 'case-insensitive',
				defaultNamespace: 'main',
				createTable: true,
				foreignKeys: true,
				views: true,
				sequenceSemantics: 'none',
			},
			mysql: {
				quoteSyntax: ['`'],
				caseFolding: 'preserve',
				defaultNamespace: '',
				createTable: true,
				foreignKeys: true,
				views: true,
				sequenceSemantics: 'none',
			},
		});

		for (const dialect of SUPPORTED_DIALECTS) {
			expect(DIALECT_CAPABILITIES[dialect]).toBeDefined();
			expect(Object.isFrozen(DIALECT_CAPABILITIES[dialect])).toBe(true);
		}
	});

	it('derives identifier rules from the capability registry', () => {
		expect(createDialectRules('postgresql').canonicalize('Users', false)).toBe(
			'users',
		);
		expect(createDialectRules('postgresql').canonicalize('Users', true)).toBe(
			'Users',
		);
		expect(createDialectRules('sqlite').canonicalize('Users', true)).toBe(
			'users',
		);
		expect(createDialectRules('mysql').canonicalize('Users', false)).toBe(
			'Users',
		);
		expect(createDialectRules('sqlite').defaultSchema.value).toBe('main');
	});

	it.each([
		['postgresql', '"Users"'],
		['sqlite', '"Users"'],
		['sqlite', '`Users`'],
		['mysql', '`Users`'],
	] as const)('preserves %s identifier quote syntax: %s', (dialect, name) => {
		const ast = parse(`CREATE TABLE ${name} (id INTEGER);`, dialect);
		expect(getDialectAstAdapter(dialect).declaration(ast, 'table')).toEqual({
			name: 'Users',
			schema: undefined,
		});
		expect(
			scanRelationNames(`CREATE TABLE ${name} (id INTEGER);`, dialect),
		).toEqual([
			{
				role: 'declaration',
				statementType: 'table',
				name: { value: 'Users', display: name, quoted: true },
				display: name,
			},
		]);
	});
});

describe('dialect AST adapters', () => {
	it.each(SUPPORTED_DIALECTS)(
		'normalizes declaration, FK, view and FROM shapes for %s',
		(dialect) => {
			const quote = (name: string): string =>
				dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
			const adapter = getDialectAstAdapter(dialect);
			const table = parse(
				`CREATE TABLE ${quote('Child')} (id INTEGER, parent_id INTEGER REFERENCES ${quote('Parent')}(id));`,
				dialect,
			);
			const view = parse(
				`CREATE VIEW ${quote('Report')} AS SELECT * FROM ${quote('Child')} c JOIN ${quote('Parent')} p ON p.id = c.parent_id;`,
				dialect,
			);

			expect(adapter.declaration(table, 'table')).toEqual({
				name: 'Child',
				schema: undefined,
			});
			expect(adapter.tableReferences(table)).toEqual([
				{ name: 'Parent', schema: undefined },
			]);
			expect(adapter.declaration(view, 'view')).toEqual({
				name: 'Report',
				schema: undefined,
			});

			const definition = adapter.viewDefinition(view);
			expect(definition).toBeDefined();
			expect(adapter.selectFromItems(definition)).toEqual([
				{
					kind: 'relation',
					relation: { name: 'Child', schema: undefined },
					on: undefined,
				},
				expect.objectContaining({
					kind: 'relation',
					relation: { name: 'Parent', schema: undefined },
				}),
			]);
		},
	);

	it.each(SUPPORTED_DIALECTS)(
		'enforces the advertised sequence semantics for %s',
		(dialect) => {
			const capabilities = DIALECT_CAPABILITIES[dialect];
			const operation = (): unknown =>
				parse('CREATE SEQUENCE example_ids START WITH 1;', dialect);

			if (capabilities.sequenceSemantics === 'create-sequence') {
				expect(
					getDialectAstAdapter(dialect).declaration(operation(), 'sequence'),
				).toEqual({ name: 'example_ids', schema: undefined });
			} else {
				expect(operation).toThrow();
			}
		},
	);

	it('keeps parser-specific relation fields out of processors', () => {
		const processorSources = [
			'create-table-processor.ts',
			'create-view-processor.ts',
			'create-sequence-processor.ts',
		].map((file) =>
			readFileSync(resolve(process.cwd(), 'src/processors', file), 'utf8'),
		);
		const collectorSource = readFileSync(
			resolve(process.cwd(), 'src/services/select-relation-collector.ts'),
			'utf8',
		);

		for (const source of [...processorSources, collectorSource]) {
			expect(source).not.toMatch(/\breference_definition\b/u);
			expect(source).not.toMatch(
				/\b(?:record|asRecord|fromItem)\.(?:db|table|view|sequence)\b/u,
			);
		}
	});
});

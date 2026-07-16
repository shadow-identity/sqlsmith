import type { SqlDialect } from '../types/dialect.js';

export type AstRelationStatementType = 'table' | 'view' | 'sequence';

export interface AstRelationName {
	readonly name: string;
	readonly schema: string | undefined;
}

export type DialectFromItem =
	| { readonly kind: 'dual' }
	| {
			readonly kind: 'relation';
			readonly relation: AstRelationName;
			readonly on: unknown;
	  }
	| {
			readonly kind: 'derived';
			readonly expression: unknown;
			readonly on: unknown;
	  }
	| { readonly kind: 'unsupported'; readonly value: unknown };

export interface DialectAstAdapter {
	readonly dialect: SqlDialect;
	declaration(
		node: unknown,
		statementType: AstRelationStatementType,
	): AstRelationName | undefined;
	tableReferences(node: unknown): readonly AstRelationName[];
	viewDefinition(node: unknown): unknown;
	selectFromItems(select: unknown): readonly DialectFromItem[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null;

const relation = (value: unknown): AstRelationName | undefined => {
	if (!isRecord(value) || typeof value.table !== 'string') return undefined;
	return {
		name: value.table,
		schema: typeof value.db === 'string' ? value.db : undefined,
	};
};

const firstRelation = (value: unknown): AstRelationName | undefined =>
	Array.isArray(value) ? relation(value[0]) : undefined;

const createNodeSqlParserAdapter = (dialect: SqlDialect): DialectAstAdapter =>
	Object.freeze({
		dialect,
		declaration(
			node: unknown,
			statementType: AstRelationStatementType,
		): AstRelationName | undefined {
			if (!isRecord(node) || node.type !== 'create') return undefined;
			if (statementType === 'table') return firstRelation(node.table);
			if (statementType === 'sequence') return firstRelation(node.sequence);

			if (typeof node.view === 'string') {
				return { name: node.view, schema: undefined };
			}
			if (isRecord(node.view) && typeof node.view.view === 'string') {
				return {
					name: node.view.view,
					schema: typeof node.view.db === 'string' ? node.view.db : undefined,
				};
			}
			return firstRelation(node.table);
		},
		tableReferences(node: unknown): readonly AstRelationName[] {
			if (!isRecord(node) || !Array.isArray(node.create_definitions)) return [];
			const references: AstRelationName[] = [];
			for (const definition of node.create_definitions) {
				if (
					!isRecord(definition) ||
					!isRecord(definition.reference_definition)
				) {
					continue;
				}
				const tables = definition.reference_definition.table;
				if (!Array.isArray(tables)) continue;
				for (const table of tables) {
					const reference = relation(table);
					if (reference) references.push(reference);
				}
			}
			return references;
		},
		viewDefinition(node: unknown): unknown {
			if (!isRecord(node) || node.type !== 'create') return undefined;
			return node.select ?? node.definition;
		},
		selectFromItems(select: unknown): readonly DialectFromItem[] {
			if (!isRecord(select)) return [];
			const rawItems = select.from ?? [];
			const items = Array.isArray(rawItems) ? rawItems : [rawItems];
			return items.map((item): DialectFromItem => {
				if (!isRecord(item)) return { kind: 'unsupported', value: item };
				if (item.type === 'dual') return { kind: 'dual' };
				const table = relation(item);
				if (table) {
					return {
						kind: 'relation',
						relation: table,
						on: item.on,
					};
				}
				if (isRecord(item.expr) && 'ast' in item.expr) {
					return {
						kind: 'derived',
						expression: item.expr,
						on: item.on,
					};
				}
				return { kind: 'unsupported', value: item };
			});
		},
	});

const adapters: Readonly<Record<SqlDialect, DialectAstAdapter>> = Object.freeze(
	{
		postgresql: createNodeSqlParserAdapter('postgresql'),
		sqlite: createNodeSqlParserAdapter('sqlite'),
		mysql: createNodeSqlParserAdapter('mysql'),
	},
);

export const getDialectAstAdapter = (dialect: SqlDialect): DialectAstAdapter =>
	adapters[dialect];

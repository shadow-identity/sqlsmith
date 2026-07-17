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

export interface AstIndexDeclaration {
	/** Index name; absent for unnamed indexes (PostgreSQL `CREATE INDEX ON …`). */
	readonly name: AstRelationName | undefined;
	/** Table the index is created on (`ON <table>`). */
	readonly table: AstRelationName | undefined;
}

export interface DialectAstAdapter {
	readonly dialect: SqlDialect;
	declaration(
		node: unknown,
		statementType: AstRelationStatementType,
	): AstRelationName | undefined;
	tableReferences(node: unknown): readonly AstRelationName[];
	indexDeclaration(node: unknown): AstIndexDeclaration | undefined;
	alterTarget(node: unknown): AstRelationName | undefined;
	alterReferences(node: unknown): readonly AstRelationName[];
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
		indexDeclaration(node: unknown): AstIndexDeclaration | undefined {
			if (
				!isRecord(node) ||
				node.type !== 'create' ||
				node.keyword !== 'index'
			) {
				return undefined;
			}
			// sqlite reports the index name as {schema, name}; pg/mysql as a string
			let name: AstRelationName | undefined;
			if (typeof node.index === 'string') {
				name = { name: node.index, schema: undefined };
			} else if (isRecord(node.index) && typeof node.index.name === 'string') {
				name = {
					name: node.index.name,
					schema:
						typeof node.index.schema === 'string'
							? node.index.schema
							: undefined,
				};
			}
			return { name, table: relation(node.table) ?? firstRelation(node.table) };
		},
		alterTarget(node: unknown): AstRelationName | undefined {
			if (!isRecord(node) || node.type !== 'alter') return undefined;
			return firstRelation(node.table);
		},
		alterReferences(node: unknown): readonly AstRelationName[] {
			if (
				!isRecord(node) ||
				node.type !== 'alter' ||
				!Array.isArray(node.expr)
			) {
				return [];
			}
			// ADD CONSTRAINT nests reference_definition under create_definitions;
			// an inline ADD COLUMN … REFERENCES puts it directly on the expr item.
			// Both differ from CREATE TABLE's flat create_definitions array.
			const references: AstRelationName[] = [];
			for (const item of node.expr) {
				if (!isRecord(item)) continue;
				const definition = isRecord(item.create_definitions)
					? item.create_definitions.reference_definition
					: item.reference_definition;
				if (!isRecord(definition) || !Array.isArray(definition.table)) continue;
				for (const table of definition.table) {
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

import { ProcessingError } from '../types/errors.js';
import {
	createRelationIdentifier,
	type IdentifierRules,
	type RelationIdentifier,
	type RelationKey,
	type SourceIdentifierPart,
	type SourceRelationName,
	unquotedRelationName,
} from '../types/relation-identifier.js';

export interface SelectRelationCollectorOptions {
	readonly identifierRules: IdentifierRules;
	/** Source-ordered FROM/JOIN names used to restore AST-lost quote metadata. */
	readonly sourceRelations?: readonly SourceRelationName[];
	readonly sourceCteAliases?: readonly SourceIdentifierPart[];
}

export interface SelectRelationCollection {
	readonly keys: ReadonlySet<RelationKey>;
	readonly relations: ReadonlyMap<RelationKey, RelationIdentifier>;
}

type UnknownRecord = Record<string, unknown>;
type SelectRecord = UnknownRecord & { readonly type: 'select' };

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null;

const shapeOf = (value: unknown): string => {
	if (isRecord(value) && typeof value.type === 'string') return value.type;
	if (Array.isArray(value)) return 'array';
	if (isRecord(value)) return Object.keys(value).sort().join(',') || 'object';
	return value === null ? 'null' : typeof value;
};

const isSelect = (value: unknown): value is SelectRecord =>
	isRecord(value) && value.type === 'select';

class SourceRelationResolver {
	readonly #relations: readonly SourceRelationName[];
	readonly #used = new Set<number>();
	readonly #rules: IdentifierRules;

	constructor(
		relations: readonly SourceRelationName[],
		rules: IdentifierRules,
	) {
		this.#relations = relations;
		this.#rules = rules;
	}

	resolve(name: string, schema?: string | null): SourceRelationName {
		const exact = this.#find((candidate) =>
			this.#matches(candidate, name, schema, false),
		);
		if (exact) return exact;

		const canonical = this.#find((candidate) =>
			this.#matches(candidate, name, schema, true),
		);
		return canonical ?? unquotedRelationName(name, schema);
	}

	#find(
		predicate: (candidate: SourceRelationName) => boolean,
	): SourceRelationName | undefined {
		const index = this.#relations.findIndex(
			(candidate, candidateIndex) =>
				!this.#used.has(candidateIndex) && predicate(candidate),
		);
		if (index < 0) return undefined;
		this.#used.add(index);
		return this.#relations[index];
	}

	#matches(
		candidate: SourceRelationName,
		name: string,
		schema: string | null | undefined,
		canonical: boolean,
	): boolean {
		const sourceSchema = candidate.schema?.value;
		if (!canonical) {
			return (
				candidate.name.value === name && sourceSchema === (schema ?? undefined)
			);
		}

		const candidateName = this.#rules.canonicalize(
			candidate.name.value,
			candidate.name.quoted,
		);
		const astName = this.#rules.canonicalize(name, false);
		if (candidateName !== astName) return false;
		if (schema === null || schema === undefined)
			return sourceSchema === undefined;
		if (!candidate.schema) return false;
		return (
			this.#rules.canonicalize(
				candidate.schema.value,
				candidate.schema.quoted,
			) === this.#rules.canonicalize(schema, false)
		);
	}
}

class SourceCteAliasResolver {
	readonly #aliases: readonly SourceIdentifierPart[];
	readonly #used = new Set<number>();

	constructor(aliases: readonly SourceIdentifierPart[]) {
		this.#aliases = aliases;
	}

	resolve(name: string): SourceIdentifierPart {
		const index = this.#aliases.findIndex(
			(alias, aliasIndex) =>
				!this.#used.has(aliasIndex) && alias.value === name,
		);
		if (index >= 0) {
			this.#used.add(index);
			return this.#aliases[index];
		}
		return { value: name, display: name, quoted: false };
	}
}

/**
 * Collect every external relation referenced by a SELECT tree while keeping
 * CTE aliases scoped. Traversal is targeted at relation-bearing SELECT/AST
 * positions; unknown FROM/CTE/set shapes fail explicitly.
 */
export const collectSelectRelations = (
	select: unknown,
	options: SelectRelationCollectorOptions,
): SelectRelationCollection => {
	const relations = new Map<RelationKey, RelationIdentifier>();
	const keys = new Set<RelationKey>();
	const resolver = new SourceRelationResolver(
		options.sourceRelations ?? [],
		options.identifierRules,
	);
	const cteAliasResolver = new SourceCteAliasResolver(
		options.sourceCteAliases ?? [],
	);
	const visitedExpressions = new WeakSet<object>();

	const unsupported = (path: string, value: unknown): never => {
		throw ProcessingError.unsupportedSelectShape(path, shapeOf(value));
	};

	const cteName = (cte: UnknownRecord, path: string): SourceIdentifierPart => {
		if (typeof cte.name === 'string') return cteAliasResolver.resolve(cte.name);
		if (isRecord(cte.name) && typeof cte.name.value === 'string') {
			return cteAliasResolver.resolve(cte.name.value);
		}
		return unsupported(`${path}.name`, cte.name);
	};

	const selectFromCte = (cte: UnknownRecord, path: string): UnknownRecord => {
		if (isSelect(cte.stmt)) return cte.stmt;
		if (isRecord(cte.stmt) && isSelect(cte.stmt.ast)) return cte.stmt.ast;
		return unsupported(`${path}.stmt`, cte.stmt);
	};

	const walkExpression = (
		value: unknown,
		scope: ReadonlySet<string>,
		path: string,
	): void => {
		if (!isRecord(value) && !Array.isArray(value)) return;
		if (visitedExpressions.has(value)) return;
		visitedExpressions.add(value);

		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				walkExpression(item, scope, `${path}[${index}]`);
			});
			return;
		}
		if (isSelect(value)) {
			walkSelect(value, scope, path);
			return;
		}
		if ('ast' in value) {
			const nested = value.ast;
			const nodes = Array.isArray(nested) ? nested : [nested];
			nodes.forEach((node, index) => {
				if (!isSelect(node)) {
					unsupported(
						Array.isArray(nested) ? `${path}.ast[${index}]` : `${path}.ast`,
						node,
					);
				}
				walkSelect(
					node,
					scope,
					Array.isArray(nested) ? `${path}.ast[${index}]` : `${path}.ast`,
				);
			});
			return;
		}

		for (const [key, child] of Object.entries(value)) {
			if (key === 'loc' || key === 'tableList' || key === 'columnList')
				continue;
			walkExpression(child, scope, `${path}.${key}`);
		}
	};

	const addFromItem = (
		item: unknown,
		scope: ReadonlySet<string>,
		path: string,
	): void => {
		const fromItem = isRecord(item) ? item : unsupported(path, item);
		if (fromItem.type === 'dual') return;

		if (typeof fromItem.table === 'string') {
			const schema = typeof fromItem.db === 'string' ? fromItem.db : undefined;
			const source = resolver.resolve(fromItem.table, schema);
			const localAlias = options.identifierRules.canonicalize(
				source.name.value,
				source.name.quoted,
			);
			if (schema === undefined && scope.has(localAlias)) return;
			const identifier = createRelationIdentifier(
				source,
				options.identifierRules,
			);
			if (!relations.has(identifier.key)) {
				relations.set(identifier.key, identifier);
				keys.add(identifier.key);
			}
			if ('on' in fromItem) walkExpression(fromItem.on, scope, `${path}.on`);
			return;
		}

		if (isRecord(fromItem.expr) && 'ast' in fromItem.expr) {
			walkExpression(fromItem.expr, scope, `${path}.expr`);
			if ('on' in fromItem) walkExpression(fromItem.on, scope, `${path}.on`);
			return;
		}

		unsupported(path, fromItem);
	};

	const walkSelect = (
		node: unknown,
		inheritedScope: ReadonlySet<string>,
		path: string,
	): void => {
		const selectNode = isSelect(node) ? node : unsupported(path, node);

		const withValue = selectNode.with;
		const withEntries: unknown[] =
			withValue === null || withValue === undefined
				? []
				: Array.isArray(withValue)
					? withValue
					: unsupported(`${path}.with`, withValue);
		const scope = new Set(inheritedScope);
		for (const [index, entry] of withEntries.entries()) {
			const cte = isRecord(entry)
				? entry
				: unsupported(`${path}.with[${index}]`, entry);
			const name = cteName(cte, `${path}.with[${index}]`);
			scope.add(options.identifierRules.canonicalize(name.value, name.quoted));
		}
		for (const [index, entry] of withEntries.entries()) {
			const cte = isRecord(entry)
				? entry
				: unsupported(`${path}.with[${index}]`, entry);
			walkSelect(
				selectFromCte(cte, `${path}.with[${index}]`),
				scope,
				`${path}.with[${index}].stmt`,
			);
		}

		walkExpression(selectNode.columns, scope, `${path}.columns`);

		const from = selectNode.from ?? [];
		const fromEntries = Array.isArray(from) ? from : [from];
		fromEntries.forEach((item, index) => {
			addFromItem(item, scope, `${path}.from[${index}]`);
		});

		for (const field of [
			'where',
			'groupby',
			'having',
			'orderby',
			'window',
			'qualify',
			'_orderby',
			'limit',
			'_limit',
		] as const) {
			walkExpression(selectNode[field], scope, `${path}.${field}`);
		}

		if (selectNode._next !== undefined && selectNode._next !== null) {
			if (!isSelect(selectNode._next)) {
				unsupported(`${path}._next`, selectNode._next);
			}
			walkSelect(selectNode._next, scope, `${path}._next`);
		}
	};

	walkSelect(select, new Set(), 'select');
	return Object.freeze({ keys, relations });
};

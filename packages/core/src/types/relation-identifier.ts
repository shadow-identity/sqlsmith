import {
	DIALECT_CAPABILITIES,
	type DialectCapabilities,
	type SqlDialect,
} from './dialect.js';

declare const relationKeyBrand: unique symbol;

/** Collision-safe serialized tuple used as the sole relation graph identity. */
export type RelationKey = string & {
	readonly [relationKeyBrand]: 'RelationKey';
};

export interface SourceIdentifierPart {
	readonly value: string;
	readonly display: string;
	readonly quoted: boolean;
}

export interface SourceRelationName {
	readonly schema?: SourceIdentifierPart;
	readonly name: SourceIdentifierPart;
	readonly display: string;
}

export interface IdentifierPart extends SourceIdentifierPart {
	readonly canonical: string;
	readonly explicit: boolean;
}

/**
 * Graph identity namespaces. `relation` covers declared relations (tables,
 * views, sequences); `index` isolates index names from relation names;
 * `statement` marks synthetic identities for statements that declare nothing
 * of their own (ALTER TABLE, unnamed indexes). Namespaces lead the key tuple,
 * so keys from different namespaces can never collide.
 */
export type IdentifierNamespace = 'relation' | 'index' | 'statement';

export interface RelationIdentifier {
	readonly namespace: IdentifierNamespace;
	readonly schema: IdentifierPart;
	readonly name: IdentifierPart;
	readonly display: string;
	readonly key: RelationKey;
}

export interface DialectRules {
	readonly dialect: SqlDialect;
	readonly capabilities: Readonly<DialectCapabilities>;
	readonly defaultSchema: SourceIdentifierPart;
	canonicalize(value: string, quoted: boolean): string;
}

const sourcePart = (
	value: string,
	display = value,
	quoted = false,
): SourceIdentifierPart => ({ value, display, quoted });

const configuredSchemaPart = (schema: string): SourceIdentifierPart => {
	const trimmed = schema.trim();
	if (trimmed.length < 2) return sourcePart(trimmed);
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return sourcePart(trimmed.slice(1, -1).replace(/""/g, '"'), trimmed, true);
	}
	if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
		return sourcePart(trimmed.slice(1, -1).replace(/``/g, '`'), trimmed, true);
	}
	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		return sourcePart(trimmed.slice(1, -1).replace(/]]/g, ']'), trimmed, true);
	}
	return sourcePart(trimmed);
};

/** Create dialect-specific canonicalization rules for relation identifiers. */
export const createDialectRules = (
	dialect: SqlDialect,
	defaultSchema?: string,
): DialectRules => {
	const capabilities = DIALECT_CAPABILITIES[dialect];
	const schema = defaultSchema ?? capabilities.defaultNamespace;
	return Object.freeze({
		dialect,
		capabilities,
		defaultSchema: Object.freeze(configuredSchemaPart(schema)),
		canonicalize(value: string, quoted: boolean): string {
			switch (capabilities.caseFolding) {
				case 'lowercase-unquoted':
					return quoted ? value : value.toLowerCase();
				case 'case-insensitive':
					return value.toLowerCase();
				case 'preserve':
					return value;
			}
		},
	});
};

const identifierPart = (
	part: SourceIdentifierPart,
	explicit: boolean,
	rules: DialectRules,
): IdentifierPart =>
	Object.freeze({
		value: part.value,
		canonical: rules.canonicalize(part.value, part.quoted),
		display: part.display,
		quoted: part.quoted,
		explicit,
	});

/** Build an immutable relation identifier without reconstructing source SQL. */
export const createRelationIdentifier = (
	source: SourceRelationName,
	rules: DialectRules,
): RelationIdentifier => {
	const schema = identifierPart(
		source.schema ?? rules.defaultSchema,
		source.schema !== undefined,
		rules,
	);
	const name = identifierPart(source.name, true, rules);
	const key = JSON.stringify([
		'relation',
		schema.canonical,
		name.canonical,
	]) as RelationKey;

	return Object.freeze({
		namespace: 'relation' as const,
		schema,
		name,
		display: source.display,
		key,
	});
};

/**
 * Build an identifier outside the `relation` namespace. Extra discriminators
 * join the key tuple, so identities that share a name can stay distinct (e.g.
 * MySQL scopes index names per table — the target table key discriminates).
 */
export const createSecondaryIdentifier = (
	namespace: 'index' | 'statement',
	source: SourceRelationName,
	rules: DialectRules,
	discriminators: readonly string[] = [],
): RelationIdentifier => {
	const schema = identifierPart(
		source.schema ?? rules.defaultSchema,
		source.schema !== undefined,
		rules,
	);
	const name = identifierPart(source.name, true, rules);
	const key = JSON.stringify([
		namespace,
		schema.canonical,
		name.canonical,
		...discriminators,
	]) as RelationKey;

	return Object.freeze({
		namespace,
		schema,
		name,
		display: source.display,
		key,
	});
};

/** Build a source-shaped unquoted name for AST fallback paths. */
export const unquotedRelationName = (
	name: string,
	schema?: string | null,
): SourceRelationName => {
	const namePart = sourcePart(name);
	const schemaPart = schema ? sourcePart(schema) : undefined;
	return {
		schema: schemaPart,
		name: namePart,
		display: schemaPart ? `${schemaPart.display}.${namePart.display}` : name,
	};
};

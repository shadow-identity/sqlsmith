import type { SqlDialect } from './sql-statement.js';

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

export interface RelationIdentifier {
	readonly namespace: 'relation';
	readonly schema: IdentifierPart;
	readonly name: IdentifierPart;
	readonly display: string;
	readonly key: RelationKey;
}

export interface IdentifierRules {
	readonly dialect: SqlDialect;
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
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return sourcePart(trimmed.slice(1, -1).replace(/""/g, '"'), trimmed, true);
	}
	return sourcePart(trimmed);
};

/** Create dialect-specific canonicalization rules for relation identifiers. */
export const createIdentifierRules = (
	dialect: SqlDialect,
	defaultSchema?: string,
): IdentifierRules => {
	const schema = defaultSchema ?? (dialect === 'postgresql' ? 'public' : '');
	return Object.freeze({
		dialect,
		defaultSchema: Object.freeze(configuredSchemaPart(schema)),
		canonicalize(value: string, quoted: boolean): string {
			if (dialect === 'postgresql' && !quoted) return value.toLowerCase();
			return value;
		},
	});
};

const identifierPart = (
	part: SourceIdentifierPart,
	explicit: boolean,
	rules: IdentifierRules,
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
	rules: IdentifierRules,
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

/** SQL dialects with executable dependency-analysis contracts. */
export const SUPPORTED_DIALECTS = Object.freeze([
	'postgresql',
	'sqlite',
	'mysql',
] as const);

export type SqlDialect = (typeof SUPPORTED_DIALECTS)[number];

export type IdentifierCaseFolding =
	| 'lowercase-unquoted'
	| 'case-insensitive'
	| 'preserve';

export type SequenceSemantics = 'create-sequence' | 'none';

export interface DialectCapabilities {
	readonly quoteSyntax: readonly ('"' | '`' | '[]')[];
	readonly caseFolding: IdentifierCaseFolding;
	/** Canonical namespace assigned to an unqualified relation. */
	readonly defaultNamespace: string;
	readonly createTable: boolean;
	readonly foreignKeys: boolean;
	readonly views: boolean;
	readonly sequenceSemantics: SequenceSemantics;
}

const capabilities = (
	value: DialectCapabilities,
): Readonly<DialectCapabilities> =>
	Object.freeze({
		...value,
		quoteSyntax: Object.freeze([...value.quoteSyntax]),
	});

/** Authoritative runtime capability registry for every public dialect. */
export const DIALECT_CAPABILITIES: Readonly<
	Record<SqlDialect, Readonly<DialectCapabilities>>
> = Object.freeze({
	postgresql: capabilities({
		quoteSyntax: ['"'],
		caseFolding: 'lowercase-unquoted',
		defaultNamespace: 'public',
		createTable: true,
		foreignKeys: true,
		views: true,
		sequenceSemantics: 'create-sequence',
	}),
	sqlite: capabilities({
		quoteSyntax: ['"', '`'],
		caseFolding: 'case-insensitive',
		defaultNamespace: 'main',
		createTable: true,
		foreignKeys: true,
		views: true,
		sequenceSemantics: 'none',
	}),
	mysql: capabilities({
		quoteSyntax: ['`'],
		caseFolding: 'preserve',
		defaultNamespace: '',
		createTable: true,
		foreignKeys: true,
		views: true,
		sequenceSemantics: 'none',
	}),
});

const supportedDialectSet: ReadonlySet<string> = new Set(SUPPORTED_DIALECTS);

export const isSupportedDialect = (value: string): value is SqlDialect =>
	supportedDialectSet.has(value);

import { DIALECT_CAPABILITIES, type SqlDialect } from '../types/dialect.js';
import type {
	SourceIdentifierPart,
	SourceRelationName,
} from '../types/relation-identifier.js';

export type RelationNameRole = 'declaration' | 'reference';
export type RelationStatementType = 'table' | 'view' | 'sequence' | 'index';
export type RelationReferenceKind =
	| 'references'
	| 'from'
	| 'join'
	| 'on'
	| 'alter'
	| 'into';

export interface LexedRelationName extends SourceRelationName {
	readonly role: RelationNameRole;
	readonly statementType: RelationStatementType;
	readonly referenceKind?: RelationReferenceKind;
}

interface Token {
	readonly kind: 'word' | 'quoted' | 'dot' | 'punctuation';
	readonly value: string;
	readonly display: string;
}

const isWordStart = (character: string): boolean =>
	/[A-Za-z_\u0080-\uFFFF]/u.test(character);

const isWordPart = (character: string): boolean =>
	/[A-Za-z0-9_$\u0080-\uFFFF]/u.test(character);

const tokenizeQuotedIdentifier = (
	sql: string,
	start: number,
	quote: '"' | '`' | '[]',
): { readonly token: Token; readonly next: number } => {
	const opening = quote === '[]' ? '[' : quote;
	const closing = quote === '[]' ? ']' : quote;
	let index = start + opening.length;
	let value = '';
	while (index < sql.length) {
		if (sql[index] !== closing) {
			value += sql[index];
			index++;
			continue;
		}
		if (sql[index + 1] === closing) {
			value += closing;
			index += 2;
			continue;
		}
		index++;
		break;
	}
	return {
		token: {
			kind: 'quoted',
			value,
			display: sql.slice(start, index),
		},
		next: index,
	};
};

const tokenize = (sql: string, dialect: SqlDialect): Token[] => {
	const tokens: Token[] = [];
	const quoteSyntax = DIALECT_CAPABILITIES[dialect].quoteSyntax;
	let index = 0;

	while (index < sql.length) {
		const character = sql[index] ?? '';

		if (/\s/u.test(character)) {
			index++;
			continue;
		}
		if (character === '-' && sql[index + 1] === '-') {
			index += 2;
			while (index < sql.length && sql[index] !== '\n') index++;
			continue;
		}
		if (character === '/' && sql[index + 1] === '*') {
			let depth = 1;
			index += 2;
			while (index < sql.length && depth > 0) {
				if (sql[index] === '/' && sql[index + 1] === '*') {
					depth++;
					index += 2;
					continue;
				}
				if (sql[index] === '*' && sql[index + 1] === '/') {
					depth--;
					index += 2;
					continue;
				}
				index++;
			}
			continue;
		}
		if (character === "'") {
			index++;
			while (index < sql.length) {
				if (sql[index] === '\\' && index + 1 < sql.length) {
					index += 2;
					continue;
				}
				if (sql[index] !== "'") {
					index++;
					continue;
				}
				if (sql[index + 1] === "'") {
					index += 2;
					continue;
				}
				index++;
				break;
			}
			continue;
		}
		if (character === '$') {
			const delimiter = sql
				.slice(index)
				.match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u)?.[0];
			if (delimiter) {
				const end = sql.indexOf(delimiter, index + delimiter.length);
				index = end === -1 ? sql.length : end + delimiter.length;
				continue;
			}
		}
		const quote = quoteSyntax.find(
			(syntax) => character === (syntax === '[]' ? '[' : syntax),
		);
		if (quote) {
			const quoted = tokenizeQuotedIdentifier(sql, index, quote);
			tokens.push(quoted.token);
			index = quoted.next;
			continue;
		}
		if (isWordStart(character)) {
			const start = index;
			index++;
			while (index < sql.length && isWordPart(sql[index] ?? '')) index++;
			const display = sql.slice(start, index);
			tokens.push({ kind: 'word', value: display, display });
			continue;
		}
		if (character === '.') {
			tokens.push({ kind: 'dot', value: '.', display: '.' });
			index++;
			continue;
		}

		tokens.push({ kind: 'punctuation', value: character, display: character });
		index++;
	}

	return tokens;
};

const tokenIdentifierPart = (
	token: Token | undefined,
): SourceIdentifierPart | undefined => {
	if (!token || (token.kind !== 'word' && token.kind !== 'quoted')) {
		return undefined;
	}
	return {
		value: token.value,
		display: token.display,
		quoted: token.kind === 'quoted',
	};
};

const closingParenthesis = (
	tokens: readonly Token[],
	open: number,
	end: number,
): number | undefined => {
	let depth = 0;
	for (let index = open; index < end; index++) {
		if (tokens[index]?.value === '(') depth++;
		if (tokens[index]?.value !== ')') continue;
		depth--;
		if (depth === 0) return index;
	}
	return undefined;
};

/** Extract WITH aliases with their original quote metadata. */
export const scanCteAliases = (
	sql: string,
	dialect: SqlDialect = 'postgresql',
): SourceIdentifierPart[] => {
	const tokens = tokenize(sql, dialect);
	const aliases: SourceIdentifierPart[] = [];

	const scanRange = (start: number, end: number): void => {
		let index = start;
		while (index < end) {
			if (
				tokens[index]?.kind !== 'word' ||
				tokens[index]?.value.toUpperCase() !== 'WITH'
			) {
				index++;
				continue;
			}

			let cursor = index + 1;
			if (tokens[cursor]?.value.toUpperCase() === 'RECURSIVE') cursor++;
			let parsedAny = false;

			while (cursor < end) {
				const alias = tokenIdentifierPart(tokens[cursor]);
				if (!alias) break;
				let afterAlias = cursor + 1;
				if (tokens[afterAlias]?.value === '(') {
					const columnsEnd = closingParenthesis(tokens, afterAlias, end);
					if (columnsEnd === undefined) break;
					afterAlias = columnsEnd + 1;
				}
				if (tokens[afterAlias]?.value.toUpperCase() !== 'AS') break;
				afterAlias++;
				if (tokens[afterAlias]?.value.toUpperCase() === 'NOT') afterAlias++;
				if (tokens[afterAlias]?.value.toUpperCase() === 'MATERIALIZED') {
					afterAlias++;
				}
				if (tokens[afterAlias]?.value !== '(') break;
				const bodyEnd = closingParenthesis(tokens, afterAlias, end);
				if (bodyEnd === undefined) break;

				aliases.push(alias);
				parsedAny = true;
				scanRange(afterAlias + 1, bodyEnd);
				cursor = bodyEnd + 1;
				if (tokens[cursor]?.value !== ',') break;
				cursor++;
			}

			index = parsedAny ? cursor : index + 1;
		}
	};

	scanRange(0, tokens.length);
	return aliases;
};

const identifierPart = (token: Token): SourceIdentifierPart | undefined => {
	return tokenIdentifierPart(token);
};

const parseRelationName = (
	tokens: readonly Token[],
	start: number,
):
	| { readonly relation: SourceRelationName; readonly next: number }
	| undefined => {
	let index = start;
	if (
		tokens[index]?.kind === 'word' &&
		tokens[index]?.value.toUpperCase() === 'ONLY'
	) {
		index++;
	}

	const firstToken = tokens[index];
	if (!firstToken) return undefined;
	const first = identifierPart(firstToken);
	if (!first) return undefined;

	if (tokens[index + 1]?.kind === 'dot') {
		const secondToken = tokens[index + 2];
		if (!secondToken) return undefined;
		const second = identifierPart(secondToken);
		if (!second) return undefined;
		return {
			relation: {
				schema: first,
				name: second,
				display: `${first.display}.${second.display}`,
			},
			next: index + 3,
		};
	}

	return {
		relation: { name: first, display: first.display },
		next: index + 1,
	};
};

const declarationType = (
	token: Token | undefined,
): RelationStatementType | undefined => {
	if (token?.kind !== 'word') return undefined;
	const keyword = token.value.toUpperCase();
	if (keyword === 'TABLE') return 'table';
	if (keyword === 'VIEW') return 'view';
	if (keyword === 'SEQUENCE') return 'sequence';
	if (keyword === 'INDEX') return 'index';
	return undefined;
};

/**
 * Scan only relation-name positions in original SQL. This deliberately avoids
 * reconstructing identifiers from an AST, because ASTs discard quote metadata.
 */
export const scanRelationNames = (
	sql: string,
	dialect: SqlDialect = 'postgresql',
): LexedRelationName[] => {
	const tokens = tokenize(sql, dialect);
	const relations: LexedRelationName[] = [];

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token?.kind !== 'word') continue;
		const keyword = token.value.toUpperCase();

		if (keyword === 'CREATE') {
			let cursor = index + 1;
			const optionalKeywords = new Set([
				'OR',
				'REPLACE',
				'TEMP',
				'TEMPORARY',
				'UNLOGGED',
				'UNIQUE',
			]);
			while (
				tokens[cursor]?.kind === 'word' &&
				optionalKeywords.has(tokens[cursor]?.value.toUpperCase() ?? '')
			) {
				cursor++;
			}
			const statementType = declarationType(tokens[cursor]);
			if (!statementType) continue;
			cursor++;
			if (
				statementType === 'index' &&
				tokens[cursor]?.value.toUpperCase() === 'CONCURRENTLY'
			) {
				cursor++;
			}
			if (
				tokens[cursor]?.value.toUpperCase() === 'IF' &&
				tokens[cursor + 1]?.value.toUpperCase() === 'NOT' &&
				tokens[cursor + 2]?.value.toUpperCase() === 'EXISTS'
			) {
				cursor += 3;
			}
			if (statementType === 'index') {
				// CREATE [UNIQUE] INDEX [name] ON <table> — the name is optional in
				// PostgreSQL; the ON table is a reference. ON is consumed only here,
				// never globally, so JOIN … ON never fabricates a relation.
				let name: SourceRelationName | undefined;
				if (tokens[cursor]?.value.toUpperCase() !== 'ON') {
					const parsedName = parseRelationName(tokens, cursor);
					if (!parsedName) continue;
					name = parsedName.relation;
					cursor = parsedName.next;
				}
				if (tokens[cursor]?.value.toUpperCase() !== 'ON') continue;
				const target = parseRelationName(tokens, cursor + 1);
				if (!target) continue;
				if (name) {
					relations.push({ role: 'declaration', statementType, ...name });
				}
				relations.push({
					role: 'reference',
					statementType: 'table',
					referenceKind: 'on',
					...target.relation,
				});
				index = target.next - 1;
				continue;
			}
			const parsed = parseRelationName(tokens, cursor);
			if (!parsed) continue;
			relations.push({
				role: 'declaration',
				statementType,
				...parsed.relation,
			});
			index = parsed.next - 1;
			continue;
		}

		if (
			keyword === 'ALTER' &&
			tokens[index + 1]?.value.toUpperCase() === 'TABLE'
		) {
			let cursor = index + 2;
			if (
				tokens[cursor]?.value.toUpperCase() === 'IF' &&
				tokens[cursor + 1]?.value.toUpperCase() === 'EXISTS'
			) {
				cursor += 2;
			}
			const parsed = parseRelationName(tokens, cursor);
			if (!parsed) continue;
			relations.push({
				role: 'reference',
				statementType: 'table',
				referenceKind: 'alter',
				...parsed.relation,
			});
			index = parsed.next - 1;
			continue;
		}

		if (
			keyword === 'REFERENCES' ||
			keyword === 'FROM' ||
			keyword === 'JOIN' ||
			keyword === 'INTO'
		) {
			const parsed = parseRelationName(tokens, index + 1);
			if (!parsed) continue;
			relations.push({
				role: 'reference',
				statementType: 'table',
				referenceKind: keyword.toLowerCase() as RelationReferenceKind,
				...parsed.relation,
			});
			index = parsed.next - 1;
		}
	}

	return relations;
};

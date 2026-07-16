import type { SqlDialect } from '../types/sql-statement.js';

export interface SqlStatementChunk {
	/** Comments and blank lines preceding the statement. */
	leadingTrivia: string;
	/**
	 * The statement itself, including its terminating `;` and a trailing
	 * same-line comment. The last chunk additionally carries any
	 * file-trailing comments.
	 */
	text: string;
	/** 1-based line where the statement text begins. */
	startLine: number;
}

const isWordChar = (char: string): boolean => /[A-Za-z0-9_$]/.test(char);

/**
 * Split SQL content into per-statement chunks at top-level `;` boundaries.
 *
 * The lexer understands single-quoted strings (with `''` escapes), E-strings
 * (backslash escapes), double-quoted identifiers, backtick identifiers,
 * line comments, block comments (nested for postgresql), dollar-quoted
 * bodies and — for sqlite — trigger `BEGIN ... END` blocks, so semicolons
 * inside any of those never split.
 *
 * Concatenating `leadingTrivia + text` over all chunks reconstructs the
 * original content exactly (losslessness).
 */
export const splitSqlStatements = (
	content: string,
	dialect: SqlDialect = 'postgresql',
): SqlStatementChunk[] => {
	const chunks: SqlStatementChunk[] = [];
	const length = content.length;

	let chunkStart = 0; // where the current chunk's region begins
	let sigStart = -1; // index of the statement's first significant char
	let blockDepth = 0; // sqlite BEGIN...END nesting
	let index = 0;

	const lineOf = (position: number): number => {
		let line = 1;
		for (let i = 0; i < position; i++) {
			if (content[i] === '\n') {
				line++;
			}
		}
		return line;
	};

	const pushChunk = (textEnd: number): void => {
		chunks.push({
			leadingTrivia: content.slice(chunkStart, sigStart),
			text: content.slice(sigStart, textEnd),
			startLine: lineOf(sigStart),
		});
		chunkStart = textEnd;
		sigStart = -1;
		blockDepth = 0;
	};

	/** Extend past `[ \t]*` and an optional same-line trailing comment. */
	const consumeTrailingComment = (from: number): number => {
		let i = from;
		while (i < length && (content[i] === ' ' || content[i] === '\t')) {
			i++;
		}
		if (content.startsWith('--', i)) {
			while (i < length && content[i] !== '\n') {
				i++;
			}
			return i;
		}
		return from;
	};

	const skipLineComment = (from: number): number => {
		let i = from + 2;
		while (i < length && content[i] !== '\n') {
			i++;
		}
		return i;
	};

	const skipBlockComment = (from: number): number => {
		// postgresql block comments nest; other dialects end at the first `*/`
		const nests = dialect === 'postgresql';
		let depth = 1;
		let i = from + 2;
		while (i < length && depth > 0) {
			if (nests && content.startsWith('/*', i)) {
				depth++;
				i += 2;
			} else if (content.startsWith('*/', i)) {
				depth--;
				i += 2;
			} else {
				i++;
			}
		}
		return i;
	};

	const skipQuoted = (
		from: number,
		quote: string,
		backslashEscapes: boolean,
	): number => {
		let i = from + 1;
		while (i < length) {
			if (backslashEscapes && content[i] === '\\') {
				i += 2;
				continue;
			}
			if (content[i] === quote) {
				// doubled quote is an escape ('' or "")
				if (content[i + 1] === quote) {
					i += 2;
					continue;
				}
				return i + 1;
			}
			i++;
		}
		return i;
	};

	const skipDollarQuoted = (from: number): number | null => {
		const match = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(content.slice(from));
		if (!match) {
			return null;
		}
		const tag = match[0];
		const bodyStart = from + tag.length;
		const closing = content.indexOf(tag, bodyStart);
		return closing === -1 ? length : closing + tag.length;
	};

	while (index < length) {
		const char = content[index];

		// comments are never significant
		if (content.startsWith('--', index)) {
			index = skipLineComment(index);
			continue;
		}
		if (content.startsWith('/*', index)) {
			index = skipBlockComment(index);
			continue;
		}

		if (/\s/.test(char)) {
			index++;
			continue;
		}

		// from here on the character is significant
		const isStatementStart = sigStart === -1;
		if (isStatementStart) {
			sigStart = index;
		}

		if (char === "'") {
			const previous = content[index - 1] ?? '';
			const beforePrevious = content[index - 2] ?? '';
			const isEString =
				(previous === 'E' || previous === 'e') && !isWordChar(beforePrevious);
			index = skipQuoted(index, "'", isEString);
			continue;
		}
		if (char === '"') {
			index = skipQuoted(index, '"', false);
			continue;
		}
		if (char === '`') {
			index = skipQuoted(index, '`', false);
			continue;
		}
		if (char === '$') {
			const end = skipDollarQuoted(index);
			if (end !== null) {
				index = end;
				continue;
			}
		}

		if (char === ';' && blockDepth === 0) {
			pushChunk(consumeTrailingComment(index + 1));
			index = chunkStart;
			continue;
		}

		if (/[A-Za-z_]/.test(char)) {
			let wordEnd = index + 1;
			while (wordEnd < length && isWordChar(content[wordEnd])) {
				wordEnd++;
			}

			if (dialect === 'sqlite') {
				const word = content.slice(index, wordEnd).toUpperCase();
				if (word === 'BEGIN' && !isStatementStart) {
					// mid-statement BEGIN opens a trigger body; a statement-initial
					// BEGIN is a transaction statement and terminates normally
					blockDepth++;
				} else if (word === 'CASE' && blockDepth > 0) {
					blockDepth++;
				} else if (word === 'END' && blockDepth > 0) {
					blockDepth--;
				}
			}

			index = wordEnd;
			continue;
		}

		index++;
	}

	if (sigStart !== -1) {
		// last statement without a trailing semicolon
		pushChunk(length);
	} else if (chunks.length > 0 && chunkStart < length) {
		// file-trailing comments/whitespace belong to the last chunk
		const last = chunks[chunks.length - 1];
		last.text += content.slice(chunkStart);
	}
	// content with no statements at all (empty or comments-only) yields []

	return chunks;
};

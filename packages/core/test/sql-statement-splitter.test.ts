import { describe, expect, it } from 'vitest';
import {
	type SqlStatementChunk,
	splitSqlStatements,
} from '../src/services/sql-statement-splitter.js';

/**
 * Splitter contract: cut original SQL content into per-statement chunks at
 * top-level `;` boundaries without ever looking inside strings, comments,
 * dollar-quoted bodies or (sqlite) trigger BEGIN...END blocks.
 *
 * Chunk shape: { leadingTrivia, text, startLine }
 * - leadingTrivia: comments/blank lines preceding the statement
 * - text: the statement itself, incl. its terminating `;` and a trailing
 *   same-line comment
 * - startLine: 1-based line where the statement text begins
 *
 * Losslessness: concatenating leadingTrivia + text over all chunks
 * reconstructs the original content exactly.
 */
describe('splitSqlStatements', () => {
	const reassemble = (chunks: SqlStatementChunk[]): string =>
		chunks.map((chunk) => chunk.leadingTrivia + chunk.text).join('');

	describe('basic splitting', () => {
		it('splits two statements into two chunks', () => {
			const sql = 'CREATE TABLE a (id INT);\nCREATE TABLE b (id INT);\n';
			const chunks = splitSqlStatements(sql);

			expect(chunks).toHaveLength(2);
			expect(chunks[0].text).toContain('CREATE TABLE a');
			expect(chunks[0].text).toContain(';');
			expect(chunks[1].text).toContain('CREATE TABLE b');
		});

		it('splits statements that share a single line', () => {
			const sql = 'CREATE TABLE a (id INT); CREATE TABLE b (id INT);';
			const chunks = splitSqlStatements(sql);

			expect(chunks).toHaveLength(2);
			expect(chunks[0].text).toContain('CREATE TABLE a');
			expect(chunks[1].text).toContain('CREATE TABLE b');
		});

		it('returns the last statement even without a trailing semicolon', () => {
			const sql = 'CREATE TABLE a (id INT);\nCREATE TABLE b (id INT)';
			const chunks = splitSqlStatements(sql);

			expect(chunks).toHaveLength(2);
			expect(chunks[1].text).toContain('CREATE TABLE b');
		});

		it('returns an empty array for empty content', () => {
			expect(splitSqlStatements('')).toEqual([]);
			expect(splitSqlStatements('   \n  \n')).toEqual([]);
		});

		it('returns an empty array for comments-only content', () => {
			expect(splitSqlStatements('-- nothing here\n/* really */\n')).toEqual([]);
		});
	});

	describe('losslessness', () => {
		const samples = [
			'CREATE TABLE a (id INT);\n\nCREATE TABLE b (id INT);\n',
			'-- header\nCREATE TABLE a (id INT); -- trailing\n-- footer comment\n',
			"INSERT INTO t (v) VALUES ('a;b');\nCREATE TABLE x (id INT)",
			'/* block; */ CREATE TABLE a (id INT);\nCREATE TABLE b (id INT);',
		];

		samples.forEach((sql, index) => {
			it(`reconstructs the original content exactly (sample ${index + 1})`, () => {
				expect(reassemble(splitSqlStatements(sql))).toBe(sql);
			});
		});
	});

	describe('semicolons inside literals and comments are not boundaries', () => {
		it('single-quoted strings', () => {
			const sql = "INSERT INTO t (v) VALUES ('a;b');";
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});

		it("single-quoted strings with '' escapes", () => {
			const sql = "INSERT INTO t (v) VALUES ('it''s; fine');";
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});

		it('E-strings with backslash escapes', () => {
			const sql = "INSERT INTO t (v) VALUES (E'a\\';b');";
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});

		it('double-quoted identifiers', () => {
			const sql = 'CREATE TABLE "we;ird" (id INT);';
			const chunks = splitSqlStatements(sql);
			expect(chunks).toHaveLength(1);
			expect(chunks[0].text).toContain('"we;ird"');
		});

		it('line comments', () => {
			const sql = 'CREATE TABLE a ( -- not a boundary;\n    id INT\n);';
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});

		it('block comments', () => {
			const sql = 'CREATE TABLE a (/* ; */ id INT);';
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});

		it('nested block comments (postgres)', () => {
			const sql = 'CREATE TABLE a (/* outer /* inner; */ still; */ id INT);';
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});

		it('dollar-quoted bodies', () => {
			const sql =
				'CREATE FUNCTION f() RETURNS void AS $$ SELECT 1; SELECT 2; $$ LANGUAGE sql;';
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});

		it('tagged dollar-quoted bodies', () => {
			const sql =
				'CREATE FUNCTION f() RETURNS void AS $fn$ SELECT 1; $notfn$; $fn$ LANGUAGE sql;';
			expect(splitSqlStatements(sql)).toHaveLength(1);
		});
	});

	describe('sqlite trigger bodies', () => {
		it('keeps BEGIN...END trigger bodies in one chunk', () => {
			const sql = [
				'CREATE TABLE users (id INTEGER PRIMARY KEY);',
				'CREATE TRIGGER trg AFTER INSERT ON users BEGIN UPDATE users SET id = 1; UPDATE users SET id = 2; END;',
				'CREATE TABLE other (id INTEGER PRIMARY KEY);',
			].join('\n');

			const chunks = splitSqlStatements(sql, 'sqlite');

			expect(chunks).toHaveLength(3);
			expect(chunks[1].text).toContain('CREATE TRIGGER');
			expect(chunks[1].text).toContain('END;');
		});

		it('does not treat postgres transaction BEGIN as a block opener', () => {
			const sql = 'BEGIN;\nCREATE TABLE a (id INT);\nCOMMIT;';
			const chunks = splitSqlStatements(sql, 'postgresql');
			expect(chunks).toHaveLength(3);
		});
	});

	describe('comment attachment', () => {
		it('attaches leading comments and blank lines to the following statement', () => {
			const sql = [
				'-- first table',
				'CREATE TABLE a (id INT);',
				'',
				'-- second table',
				'-- with two comment lines',
				'CREATE TABLE b (id INT);',
			].join('\n');

			const chunks = splitSqlStatements(sql);

			expect(chunks).toHaveLength(2);
			expect(chunks[0].leadingTrivia).toContain('-- first table');
			expect(chunks[0].text.startsWith('CREATE TABLE a')).toBe(true);
			expect(chunks[1].leadingTrivia).toContain('-- second table');
			expect(chunks[1].leadingTrivia).toContain('-- with two comment lines');
			expect(chunks[1].text.startsWith('CREATE TABLE b')).toBe(true);
		});

		it('keeps a same-line trailing comment with its statement', () => {
			const sql =
				'CREATE TABLE a (id INT); -- belongs to a\nCREATE TABLE b (id INT);';
			const chunks = splitSqlStatements(sql);

			expect(chunks).toHaveLength(2);
			expect(chunks[0].text).toContain('-- belongs to a');
			expect(chunks[1].text).not.toContain('belongs to a');
		});

		it('appends file-trailing comments to the last chunk', () => {
			const sql = 'CREATE TABLE a (id INT);\n-- the end\n';
			const chunks = splitSqlStatements(sql);

			expect(chunks).toHaveLength(1);
			expect(chunks[0].text).toContain('-- the end');
		});
	});

	describe('startLine', () => {
		it('reports the 1-based line where the statement text begins', () => {
			const sql = [
				'-- comment on line 1',
				'CREATE TABLE a (id INT);',
				'',
				'CREATE TABLE b (id INT);',
			].join('\n');

			const chunks = splitSqlStatements(sql);

			expect(chunks[0].startLine).toBe(2);
			expect(chunks[1].startLine).toBe(4);
		});
	});
});

import { describe, expect, it } from 'vitest';
import { scanRelationNames } from '../src/services/sql-identifier-lexer.js';

// C6A-LEXER / R6A-06

describe('SQL identifier lexer', () => {
	it('preserves qualification and quoting for declarations and references', () => {
		const sql = `
      CREATE TABLE "tenant""one"."User.Name" (
        id bigint PRIMARY KEY,
		parent_id bigint REFERENCES public.users(id),
		note text DEFAULT E'it\\'s REFERENCES ignored.table',
		body text DEFAULT $$REFERENCES also.ignored$$
      );
    `;

		expect(scanRelationNames(sql)).toEqual([
			{
				role: 'declaration',
				statementType: 'table',
				schema: {
					value: 'tenant"one',
					display: '"tenant""one"',
					quoted: true,
				},
				name: {
					value: 'User.Name',
					display: '"User.Name"',
					quoted: true,
				},
				display: '"tenant""one"."User.Name"',
			},
			{
				role: 'reference',
				statementType: 'table',
				referenceKind: 'references',
				schema: {
					value: 'public',
					display: 'public',
					quoted: false,
				},
				name: {
					value: 'users',
					display: 'users',
					quoted: false,
				},
				display: 'public.users',
			},
		]);
	});

	it('recognizes relation declarations and FROM/JOIN references without reading comments', () => {
		const sql = `
      -- CREATE TABLE ignored.table (id int);
      /* outer /* nested */ REFERENCES also.ignored */
      CREATE VIEW audit.report AS
      SELECT * FROM public.users u JOIN "tenant.one".orders o ON o.id = u.id;
      CREATE SEQUENCE audit.report_ids;
    `;

		expect(
			scanRelationNames(sql).map(
				({ role, statementType, referenceKind, display }) => ({
					role,
					statementType,
					referenceKind,
					display,
				}),
			),
		).toEqual([
			{
				role: 'declaration',
				statementType: 'view',
				referenceKind: undefined,
				display: 'audit.report',
			},
			{
				role: 'reference',
				statementType: 'table',
				referenceKind: 'from',
				display: 'public.users',
			},
			{
				role: 'reference',
				statementType: 'table',
				referenceKind: 'join',
				display: '"tenant.one".orders',
			},
			{
				role: 'declaration',
				statementType: 'sequence',
				referenceKind: undefined,
				display: 'audit.report_ids',
			},
		]);
	});

	it('recognizes CREATE INDEX declarations with their ON table reference', () => {
		expect(
			scanRelationNames('CREATE UNIQUE INDEX "Idx" ON "Users" ("Id");').map(
				({ role, statementType, referenceKind, display }) => ({
					role,
					statementType,
					referenceKind,
					display,
				}),
			),
		).toEqual([
			{
				role: 'declaration',
				statementType: 'index',
				referenceKind: undefined,
				display: '"Idx"',
			},
			{
				role: 'reference',
				statementType: 'table',
				referenceKind: 'on',
				display: '"Users"',
			},
		]);
	});

	it('captures the target of an unnamed CREATE INDEX as an ON reference', () => {
		expect(
			scanRelationNames('CREATE INDEX ON users (name);').map(
				({ role, referenceKind, display }) => ({
					role,
					referenceKind,
					display,
				}),
			),
		).toEqual([
			{
				role: 'reference',
				referenceKind: 'on',
				display: 'users',
			},
		]);
	});

	it('recognizes ALTER TABLE targets and INSERT INTO references', () => {
		expect(
			scanRelationNames(
				'ALTER TABLE ONLY public.users ADD COLUMN age integer;',
			).map(({ role, referenceKind, display }) => ({
				role,
				referenceKind,
				display,
			})),
		).toEqual([
			{
				role: 'reference',
				referenceKind: 'alter',
				display: 'public.users',
			},
		]);

		expect(
			scanRelationNames('INSERT INTO audit.log (id) VALUES (1);').map(
				({ role, referenceKind, display }) => ({
					role,
					referenceKind,
					display,
				}),
			),
		).toEqual([
			{
				role: 'reference',
				referenceKind: 'into',
				display: 'audit.log',
			},
		]);
	});

	it('does not treat JOIN ... ON as a relation reference', () => {
		expect(
			scanRelationNames('SELECT * FROM a JOIN b ON a.id = b.id;').map(
				({ referenceKind, display }) => ({ referenceKind, display }),
			),
		).toEqual([
			{ referenceKind: 'from', display: 'a' },
			{ referenceKind: 'join', display: 'b' },
		]);
	});
});

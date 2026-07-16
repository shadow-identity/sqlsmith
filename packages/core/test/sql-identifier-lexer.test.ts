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
});

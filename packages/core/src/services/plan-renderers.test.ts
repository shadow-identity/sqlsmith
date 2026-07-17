import { resolve } from 'node:path';
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {
	createDialectRules,
	createRelationIdentifier,
	Logger,
	type MergeDiagnostic,
	type MergePlan,
	renderDependencyGraph,
	renderDiagnostic,
	renderDiagnostics,
	renderDiscoveredFiles,
	renderRecommendedOrder,
	renderValidationSummary,
	SqlMerger,
	unquotedRelationName,
} from '../index.js';

/**
 * Renderer contract: every renderer takes (logger, plan) and writes
 * human-readable lines through the logger, so output respects log levels
 * and always lands on stderr. Plans are built through the public API.
 */
describe('plan renderers', () => {
	const fixture = resolve(
		process.cwd(),
		'test/fixtures/postgresql/correct/raw_statements',
	);

	let plan: MergePlan;
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	const stderrText = (): string =>
		stderrSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('');

	beforeAll(() => {
		const merger = new SqlMerger({
			logger: new Logger({ logLevel: 'silent' }),
		});
		plan = merger.planDirectory(fixture, 'postgresql');
	});

	beforeEach(() => {
		stderrSpy = vi
			.spyOn(process.stderr, 'write')
			.mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renderDiagnostics reports raw statements as info, without a warning prefix', () => {
		renderDiagnostics(new Logger(), plan);

		expect(stderrText()).toContain('unrecognized statement(s)');
		expect(stderrText()).not.toContain('⚠️');
	});

	it('renderDiagnostic keeps the warning prefix for raw-only files', () => {
		const diagnostic: MergeDiagnostic = {
			code: 'RAW_ONLY_FILE',
			severity: 'warning',
			message:
				'1 statement(s) from files with no recognized statements are appended at the end of the output',
			count: 1,
			statements: ['seed.sql#1'],
		};

		renderDiagnostic(new Logger(), diagnostic);

		expect(stderrText()).toContain('⚠️');
		expect(stderrText()).toContain('appended at the end');
	});

	it('renderDiagnostic warns about cross-file raw references with both files', () => {
		const diagnostic: MergeDiagnostic = {
			code: 'RAW_CROSS_FILE_REFERENCE',
			severity: 'warning',
			message:
				"Raw statement 'audit.sql#2' references 'users' defined in users.sql; its order relative to that definition is not guaranteed",
			statementName: 'audit.sql#2',
			dependencyName: 'users',
			dependencyKey: '["relation","public","users"]' as never,
			filePath: '/virtual/audit.sql',
			definitionFilePath: '/virtual/users.sql',
		};

		renderDiagnostic(new Logger(), diagnostic);

		expect(stderrText()).toContain('⚠️');
		expect(stderrText()).toContain('audit.sql#2');
		expect(stderrText()).toContain('users.sql');
	});

	it('renderDiagnostic reports a single external reference diagnostic', () => {
		const rules = createDialectRules('postgresql');
		const orders = createRelationIdentifier(
			unquotedRelationName('orders'),
			rules,
		);
		const users = createRelationIdentifier(
			unquotedRelationName('users'),
			rules,
		);
		const diagnostic: MergeDiagnostic = {
			code: 'EXTERNAL_REFERENCE',
			severity: 'warning',
			message: `External reference: '${orders.display}' depends on '${users.display}' which is not defined in the input files`,
			statementName: orders.display,
			statementKey: orders.key,
			dependencyName: users.display,
			dependencyKey: users.key,
		};

		renderDiagnostic(new Logger(), diagnostic);

		expect(stderrText()).toContain('External reference');
		expect(stderrText()).toContain('orders');
	});

	it('renderDependencyGraph reports nodes with their edges', () => {
		renderDependencyGraph(new Logger(), plan);

		expect(stderrText()).toContain('Dependency Graph');
		expect(stderrText()).toContain('TABLE: users');
		expect(stderrText()).toContain('Depends on');
		expect(stderrText()).toContain('Referenced by: audit');
	});

	it('renderRecommendedOrder lists ordered statements with dependency reasons', () => {
		renderRecommendedOrder(new Logger(), plan);

		expect(stderrText()).toContain('Recommended execution order');
		expect(stderrText()).toContain('users.sql');
		expect(stderrText()).toContain('depends on: users');
		expect(stderrText().indexOf('table:users')).toBeLessThan(
			stderrText().indexOf('table:audit'),
		);
	});

	it('renderValidationSummary reports per-file statements and totals', () => {
		renderValidationSummary(new Logger(), plan);

		expect(stderrText()).toContain('users.sql');
		expect(stderrText()).toContain('audit.sql');
		expect(stderrText()).toContain('Total: 2 files');
	});

	it('renderDiscoveredFiles reports each file with its statement count at debug level', () => {
		renderDiscoveredFiles(new Logger({ logLevel: 'debug' }), plan);

		expect(stderrText()).toContain('Discovered 2 SQL file(s)');
		expect(stderrText()).toContain('users.sql');
		expect(stderrText()).toContain('audit.sql');
		expect(stderrText()).toMatch(/statement/);
	});

	it('renderDiscoveredFiles stays silent below debug level', () => {
		renderDiscoveredFiles(new Logger({ logLevel: 'info' }), plan);

		expect(stderrText()).toBe('');
	});
});

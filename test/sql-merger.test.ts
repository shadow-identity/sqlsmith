import { existsSync, readFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { type SqlDialect, SqlMerger } from '../src/sql-merger.js';

describe('SqlMerger', () => {
	const merger = new SqlMerger();

	// Test dialects with their corresponding fixture directories
	const dialects: SqlDialect[] = ['postgresql', 'sqlite'];

	// Test scenarios - each is a self-contained test case
	const testScenarios = [
		'base_tables',
		'single_foreign_keys',
		'composite_foreign_keys',
		'self_referencing',
		'multiple_foreign_keys',
		'complex_scenario',
	];

	// Invalid test scenarios that should fail
	const invalidScenarios = [
		'circular_dependency',
		'bad_statement_order',
		'duplicate_table_names',
	];

	const getFixturePath = (dialect: SqlDialect, scenario: string) =>
		resolve(process.cwd(), `test/fixtures/${dialect}/${scenario}`);

	describe('findSqlFiles', () => {
		it('should find SQL files in test fixtures directory', () => {
			const scenarioPath = getFixturePath('postgresql', 'correct/base_tables');
			const sqlFiles = merger.findSqlFiles(scenarioPath);

			expect(sqlFiles.length).toBeGreaterThan(0);
			sqlFiles.forEach((file) => {
				expect(file).toMatch(/\.sql$/);
			});
		});

		it('should return empty array for directory with no SQL files', () => {
			// Use src directory which has .ts files but no .sql files
			const srcPath = resolve(process.cwd(), 'src');
			const sqlFiles = merger.findSqlFiles(srcPath);

			expect(sqlFiles).toHaveLength(0);
		});

		it('should throw error for non-existent directory', () => {
			const nonExistentPath = resolve(process.cwd(), 'test/non-existent');

			expect(() => merger.findSqlFiles(nonExistentPath)).toThrow();
		});
	});

	describe('parseStatement', () => {
		it('should parse simple CREATE TABLE statement', () => {
			const sql = 'CREATE TABLE foo (a VARCHAR(255));';

			const result = merger.parseStatement(sql, 'postgresql');

			expect(result.ast).toBeDefined();
			expect(Array.isArray(result.ast)).toBe(true);
			expect(result.ast[0].type).toBe('create');
			expect(result.dependencies).toHaveLength(1);
			expect(result.dependencies[0].tableName).toBe('foo');
			expect(result.dependencies[0].dependsOn).toHaveLength(0);
		});

		it('should parse CREATE TABLE with FOREIGN KEY', () => {
			const sql =
				'CREATE TABLE bar (id INT, b VARCHAR(255), FOREIGN KEY (b) REFERENCES foo(a));';

			const result = merger.parseStatement(sql, 'postgresql');

			expect(result.ast).toBeDefined();
			expect(Array.isArray(result.ast)).toBe(true);
			expect(result.ast[0].type).toBe('create');
			expect(result.dependencies).toHaveLength(1);
			expect(result.dependencies[0].tableName).toBe('bar');
			expect(result.dependencies[0].dependsOn).toContain('foo');
		});

		it('should handle invalid SQL', () => {
			const invalidSql = 'INVALID SQL STATEMENT;';

			expect(() => merger.parseStatement(invalidSql, 'postgresql')).toThrow(
				'Failed to parse SQL',
			);
		});

		it('should work with different SQL dialects', () => {
			const sql = 'CREATE TABLE test (id INT);';

			const pgResult = merger.parseStatement(sql, 'postgresql');
			const mysqlResult = merger.parseStatement(sql, 'mysql');

			expect(pgResult.ast).toBeDefined();
			expect(mysqlResult.ast).toBeDefined();
			// Both should parse successfully
			expect(pgResult.dependencies[0].tableName).toBe('test');
			expect(mysqlResult.dependencies[0].tableName).toBe('test');
		});
	});

	describe('extractDependencies', () => {
		it('should extract table name from CREATE TABLE AST', () => {
			const ast = {
				type: 'create',
				keyword: 'table',
				table: { table: 'foo' },
				create_definitions: [],
			};
			const tableList = ['create::null::foo'];

			const dependencies = merger.extractDependencies(ast, tableList);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0].tableName).toBe('foo');
			expect(dependencies[0].dependsOn).toHaveLength(0);
		});

		it('should extract REFERENCES from AST', () => {
			const ast = {
				type: 'create',
				keyword: 'table',
				table: { table: 'bar' },
				create_definitions: [
					{
						resource: 'column',
						reference_definition: {
							table: { table: 'foo' },
						},
					},
				],
			};
			const tableList = ['create::null::bar'];

			const dependencies = merger.extractDependencies(ast, tableList);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0].tableName).toBe('bar');
			expect(dependencies[0].dependsOn).toContain('foo');
		});

		it('should handle empty AST', () => {
			const ast = {};
			const tableList: string[] = [];

			const dependencies = merger.extractDependencies(ast, tableList);

			expect(dependencies).toHaveLength(0);
		});
	});

	describe('buildDependencyGraph', () => {
		it('should build graph from SQL files', () => {
			const sqlFiles = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo...',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
				{
					path: 'bar.sql',
					content: 'CREATE TABLE bar...',
					dependencies: [{ tableName: 'bar', dependsOn: ['foo'] }],
				},
			];

			const graph = merger.buildDependencyGraph(sqlFiles);

			expect(graph.nodes.has('foo')).toBe(true);
			expect(graph.nodes.has('bar')).toBe(true);
			expect(graph.edges.get('bar')?.has('foo')).toBe(true);
			expect(graph.reversedEdges.get('foo')?.has('bar')).toBe(true);
		});

		it('should handle tables with no dependencies', () => {
			const sqlFiles = [
				{
					path: 'standalone.sql',
					content: 'CREATE TABLE standalone...',
					dependencies: [{ tableName: 'standalone', dependsOn: [] }],
				},
			];

			const graph = merger.buildDependencyGraph(sqlFiles);

			expect(graph.nodes.has('standalone')).toBe(true);
			expect(graph.edges.get('standalone')?.size).toBe(0);
		});
	});

	describe('detectCycles', () => {
		it('should detect no cycles in acyclic graph', () => {
			const graph = {
				nodes: new Set(['foo', 'bar']),
				edges: new Map([
					['foo', new Set<string>()],
					['bar', new Set<string>(['foo'])],
				]),
				reversedEdges: new Map([
					['foo', new Set<string>(['bar'])],
					['bar', new Set<string>()],
				]),
			};

			const cycles = merger.detectCycles(graph);

			expect(cycles).toHaveLength(0);
		});

		it('should detect cycles in circular graph', () => {
			const graph = {
				nodes: new Set(['foo', 'bar', 'baz']),
				edges: new Map([
					['foo', new Set<string>(['baz'])],
					['bar', new Set<string>(['foo'])],
					['baz', new Set<string>(['bar'])],
				]),
				reversedEdges: new Map([
					['foo', new Set<string>(['bar'])],
					['bar', new Set<string>(['baz'])],
					['baz', new Set<string>(['foo'])],
				]),
			};

			const cycles = merger.detectCycles(graph);

			expect(cycles.length).toBeGreaterThan(0);
			// Should detect the circular dependency
			expect(cycles[0]).toContain('foo');
			expect(cycles[0]).toContain('bar');
			expect(cycles[0]).toContain('baz');
		});
	});

	describe('parseSingleFile', () => {
		dialects.forEach((dialect) => {
			describe(`${dialect} dialect`, () => {
				const circularFixturesPath = getFixturePath(
					dialect,
					'invalid/circular_dependency',
				);

				describe('circular dependency fixtures', () => {
					it('should parse foo.sql file with dependency on baz', () => {
						const fooPath = resolve(circularFixturesPath, 'foo.sql');

						const result = merger.parseSingleFile(fooPath, dialect);

						expect(result.path).toBe(fooPath);
						expect(result.content).toContain('CREATE TABLE foo');
						expect(result.ast).toBeDefined();
						expect(result.dependencies).toHaveLength(1);
						expect(result.dependencies[0].tableName).toBe('foo');
						expect(result.dependencies[0].dependsOn).toContain('baz');
					});

					it('should parse bar.sql file with dependency on foo', () => {
						const barPath = resolve(circularFixturesPath, 'bar.sql');

						const result = merger.parseSingleFile(barPath, dialect);

						expect(result.path).toBe(barPath);
						expect(result.content).toContain('CREATE TABLE bar');
						expect(result.ast).toBeDefined();
						expect(result.dependencies).toHaveLength(1);
						expect(result.dependencies[0].tableName).toBe('bar');
						expect(result.dependencies[0].dependsOn).toContain('foo');
					});

					it('should parse baz.sql file with dependency on bar', () => {
						const bazPath = resolve(circularFixturesPath, 'baz.sql');

						const result = merger.parseSingleFile(bazPath, dialect);

						expect(result.path).toBe(bazPath);
						expect(result.content).toContain('CREATE TABLE baz');
						expect(result.ast).toBeDefined();
						expect(result.dependencies).toHaveLength(1);
						expect(result.dependencies[0].tableName).toBe('baz');
						expect(result.dependencies[0].dependsOn).toContain('bar');
					});
				});

				it('should throw error for non-existent file', () => {
					const nonExistentPath = resolve(
						__dirname,
						'fixtures',
						'nonexistent.sql',
					);

					expect(() =>
						merger.parseSingleFile(nonExistentPath, dialect),
					).toThrow();
				});
			});
		});
	});

	describe('parseSqlFile (directory parsing)', () => {
		dialects.forEach((dialect) => {
			describe(`${dialect} dialect`, () => {
				const circularFixturesPath = getFixturePath(
					dialect,
					'invalid/circular_dependency',
				);

				describe('incorrect configuration - should fail', () => {
					it('should detect circular dependency and throw error', () => {
						expect(() =>
							merger.parseSqlFile(circularFixturesPath, dialect),
						).toThrow('Circular dependencies detected');
					});
				});
			});
		});
	});

	describe('topologicalSort', () => {
		it('should correctly order files with dependencies', () => {
			const files = [
				{
					path: 'bar.sql',
					content: 'CREATE TABLE bar...',
					dependencies: [{ tableName: 'bar', dependsOn: ['foo'] }],
				},
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo...',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const sorted = merger.topologicalSort(files);

			expect(sorted).toHaveLength(2);
			expect(sorted[0].dependencies[0].tableName).toBe('foo'); // foo should come first
			expect(sorted[1].dependencies[0].tableName).toBe('bar'); // bar should come second
		});

		it('should handle single file with no dependencies', () => {
			const files = [
				{
					path: 'standalone.sql',
					content: 'CREATE TABLE standalone...',
					dependencies: [{ tableName: 'standalone', dependsOn: [] }],
				},
			];

			const sorted = merger.topologicalSort(files);

			expect(sorted).toHaveLength(1);
			expect(sorted[0].dependencies[0].tableName).toBe('standalone');
		});

		it('should handle empty array', () => {
			const sorted = merger.topologicalSort([]);

			expect(sorted).toHaveLength(0);
		});
	});

	describe('mergeFiles', () => {
		it('should merge files in topological order with default options', () => {
			const files = [
				{
					path: 'bar.sql',
					content:
						'CREATE TABLE bar (id INT, b VARCHAR(255), FOREIGN KEY (b) REFERENCES foo(a));',
					dependencies: [{ tableName: 'bar', dependsOn: ['foo'] }],
				},
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255));',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const merged = merger.mergeFiles(files);

			expect(merged).toBeDefined();
			expect(merged).toContain('SQL Merger Output');
			expect(merged).toContain('CREATE TABLE foo');
			expect(merged).toContain('CREATE TABLE bar');

			// Check order: foo should appear before bar in the output
			const fooIndex = merged.indexOf('CREATE TABLE foo');
			const barIndex = merged.indexOf('CREATE TABLE bar');
			expect(fooIndex).toBeLessThan(barIndex);
		});

		it('should merge files without comments when addComments=false', () => {
			const files = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255));',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const merged = merger.mergeFiles(files, { addComments: false });

			expect(merged).toBeDefined();
			expect(merged).toContain('CREATE TABLE foo');
			expect(merged).not.toContain('File:');
		});

		it('should merge files without header when includeHeader=false', () => {
			const files = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255));',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const merged = merger.mergeFiles(files, { includeHeader: false });

			expect(merged).toBeDefined();
			expect(merged).toContain('CREATE TABLE foo');
			expect(merged).not.toContain('SQL Merger Output');
		});

		it('should merge files with minimal output when all options disabled', () => {
			const files = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255));',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const merged = merger.mergeFiles(files, {
				addComments: false,
				includeHeader: false,
				separateStatements: false,
			});

			expect(merged).toBeDefined();
			expect(merged.trim()).toBe('CREATE TABLE foo (a VARCHAR(255));');
		});

		it('should add semicolon if missing from SQL content', () => {
			const files = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255))', // Missing semicolon
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const merged = merger.mergeFiles(files, {
				addComments: false,
				includeHeader: false,
				separateStatements: false,
			});

			expect(merged).toBeDefined();
			expect(merged.trim()).toBe('CREATE TABLE foo (a VARCHAR(255));');
		});

		it('should preserve original formatting and comments in SQL', () => {
			const files = [
				{
					path: 'foo.sql',
					content: `-- This is a comment
CREATE TABLE foo (
    a VARCHAR(255) -- inline comment
);`,
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const merged = merger.mergeFiles(files);

			expect(merged).toBeDefined();
			expect(merged).toContain('-- This is a comment');
			expect(merged).toContain('-- inline comment');
			expect(merged).toContain('CREATE TABLE foo');
		});

		it('should write output to file when outputPath is provided', () => {
			const files = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255));',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const outputPath = resolve(process.cwd(), 'test-output.sql');

			// Clean up any existing file
			if (existsSync(outputPath)) {
				unlinkSync(outputPath);
			}

			const merged = merger.mergeFiles(files, { outputPath });

			expect(merged).toBeDefined();
			expect(existsSync(outputPath)).toBe(true);

			const fileContent = readFileSync(outputPath, 'utf-8');
			expect(fileContent).toContain('CREATE TABLE foo');
			expect(fileContent).toContain('SQL Merger Output');

			// Clean up
			unlinkSync(outputPath);
		});

		it('should throw error for invalid output file path', () => {
			const files = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255));',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const invalidPath = '/invalid/path/that/does/not/exist/output.sql';

			expect(() =>
				merger.mergeFiles(files, { outputPath: invalidPath }),
			).toThrow();
		});

		it('should default to stdout when no outputPath is provided', () => {
			const files = [
				{
					path: 'foo.sql',
					content: 'CREATE TABLE foo (a VARCHAR(255));',
					dependencies: [{ tableName: 'foo', dependsOn: [] }],
				},
			];

			const merged = merger.mergeFiles(files);

			expect(merged).toBeDefined();
			expect(merged).toContain('CREATE TABLE foo');
			expect(merged).toContain('SQL Merger Output');
		});
	});

	// Hybrid Approach: Data-Driven Scenario Tests
	describe('Data-Driven Scenario Testing', () => {
		dialects.forEach((dialect) => {
			describe(`${dialect} dialect`, () => {
				testScenarios.forEach((scenario) => {
					it(`should handle ${scenario} scenario correctly`, () => {
						const scenarioPath = getFixturePath(dialect, `correct/${scenario}`);
						const expectedPath = resolve(
							process.cwd(),
							`test/fixtures/${dialect}/correct/${scenario}.expected.sql`,
						);

						// Parse and merge the SQL files
						const result = merger.parseSqlFile(scenarioPath, dialect);
						const actual = merger.mergeFiles(result, {
							addComments: false,
							includeHeader: false,
						});

						// Read expected output
						const expected = readFileSync(expectedPath, 'utf-8');

						// Compare actual vs expected
						expect(actual.trim()).toBe(expected.trim());
					});
				});
			});
		});
	});

	// Data-Driven Invalid Scenario Tests
	describe('Data-Driven Invalid Scenario Testing', () => {
		dialects.forEach((dialect) => {
			describe(`${dialect} dialect`, () => {
				invalidScenarios.forEach((scenario) => {
					it(`should throw error for ${scenario} scenario`, () => {
						const scenarioPath = getFixturePath(dialect, `invalid/${scenario}`);

						// These scenarios should throw errors
						expect(() => merger.parseSqlFile(scenarioPath, dialect)).toThrow();
					});
				});
			});
		});
	});

	// Special Edge Case Validations
	describe('Special Scenario Validations', () => {
		dialects.forEach((dialect) => {
			describe(`${dialect} dialect`, () => {
				it('should correctly handle self-references without circular dependency errors', () => {
					const scenarioPath = getFixturePath(
						dialect,
						'correct/self_referencing',
					);

					// This should NOT throw a circular dependency error
					expect(() => {
						const result = merger.parseSqlFile(scenarioPath, dialect);
						expect(result.length).toBeGreaterThan(0);
					}).not.toThrow();
				});

				it('should handle complex multi-level dependencies correctly', () => {
					const scenarioPath = getFixturePath(
						dialect,
						'correct/complex_scenario',
					);
					const result = merger.parseSqlFile(scenarioPath, dialect);
					const sorted = merger.topologicalSort(result);

					// Verify complex dependency chain is properly ordered
					const tableOrder = sorted.flatMap((file) =>
						file.dependencies.map((dep) => dep.tableName),
					);

					// zebra_countries should come before york_cities (alphabetically they're in reverse order!)
					const countriesIndex = tableOrder.indexOf('zebra_countries');
					const citiesIndex = tableOrder.indexOf('york_cities');
					expect(countriesIndex).toBeLessThan(citiesIndex);

					// york_cities should come before xray_companies
					const companiesIndex = tableOrder.indexOf('xray_companies');
					expect(citiesIndex).toBeLessThan(companiesIndex);

					// xray_companies should come before whiskey_employees and victor_products
					const employeesIndex = tableOrder.indexOf('whiskey_employees');
					const productsIndex = tableOrder.indexOf('victor_products');
					expect(companiesIndex).toBeLessThan(employeesIndex);
					expect(companiesIndex).toBeLessThan(productsIndex);

					// alpha_orders should come last (depends on employees and products)
					const ordersIndex = tableOrder.indexOf('alpha_orders');
					expect(employeesIndex).toBeLessThan(ordersIndex);
					expect(productsIndex).toBeLessThan(ordersIndex);
				});
			});
		});
	});
});

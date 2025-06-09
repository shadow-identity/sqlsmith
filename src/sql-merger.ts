import pkg from 'node-sql-parser';

const { Parser } = pkg;

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

export type SqlDependency = {
	tableName: string;
	dependsOn: string[];
};

export type SqlFile = {
	path: string;
	content: string;
	ast?: any; // Store the parsed AST for inspection
	dependencies: SqlDependency[];
};

export type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'bigquery';

export type DependencyGraph = {
	nodes: Set<string>;
	edges: Map<string, Set<string>>; // table -> set of tables it depends on
	reversedEdges: Map<string, Set<string>>; // table -> set of tables that depend on it
};

export class SqlMerger {
	parser = new Parser();

	/**
	 * Find all SQL files in a directory
	 */
	findSqlFiles = (directoryPath: string): string[] => {
		const sqlFiles: string[] = [];

		try {
			const entries = readdirSync(directoryPath);

			for (const entry of entries) {
				const fullPath = join(directoryPath, entry);
				const stats = statSync(fullPath);

				if (stats.isFile() && extname(entry).toLowerCase() === '.sql') {
					sqlFiles.push(fullPath);
				}
			}

			return sqlFiles.sort(); // Sort for consistent ordering
		} catch (error) {
			throw new Error(`Failed to scan directory ${directoryPath}: ${error}`);
		}
	};

	/**
	 * Parse a single SQL statement and extract table dependencies
	 */
	parseStatement = (
		sql: string,
		dialect: SqlDialect = 'postgresql',
	): { ast: any; dependencies: SqlDependency[] } => {
		try {
			const opt = { database: dialect };

			// Use parser.parse() which gives us everything at once
			const { tableList, columnList, ast } = this.parser.parse(sql, opt);

			// Extract dependencies from the parsed AST and table list
			const dependencies = this.extractDependencies(ast, tableList);

			return { ast, dependencies };
		} catch (error: any) {
			throw new Error(`Failed to parse SQL: ${error.message}`);
		}
	};

	/**
	 * Extract table dependencies from AST and table list
	 */
	extractDependencies = (ast: any, tableList: string[]): SqlDependency[] => {
		const dependencies: SqlDependency[] = [];

		// Find CREATE TABLE statements in the AST
		const statements = Array.isArray(ast) ? ast : [ast];

		for (const statement of statements) {
			if (statement?.type === 'create' && statement?.keyword === 'table') {
				const tableName = statement.table?.[0]?.table || statement.table?.table;

				if (tableName) {
					const dependsOn: string[] = [];

					// Look for FOREIGN KEY constraints in create_definitions
					if (statement.create_definitions) {
						for (const item of statement.create_definitions) {
							// Handle FOREIGN KEY constraints
							if (
								item.constraint_type === 'FOREIGN KEY' &&
								item.reference_definition
							) {
								const refTable =
									item.reference_definition.table?.[0]?.table ||
									item.reference_definition.table?.table;
								if (refTable && !dependsOn.includes(refTable)) {
									dependsOn.push(refTable);
								}
							}

							// Handle column-level REFERENCES
							if (item.resource === 'column' && item.reference_definition) {
								const refTable =
									item.reference_definition.table?.[0]?.table ||
									item.reference_definition.table?.table;
								if (refTable && !dependsOn.includes(refTable)) {
									dependsOn.push(refTable);
								}
							}
						}
					}

					dependencies.push({
						tableName,
						dependsOn,
					});
				}
			}
		}

		// If no dependencies found from AST, try to extract from tableList
		if (dependencies.length === 0 && tableList.length > 0) {
			// Parse table list format: ["create::null::tablename", "select::null::reftable"]
			const createdTables = tableList
				.filter((item) => item.startsWith('create::'))
				.map((item) => item.split('::')[2]);

			const referencedTables = tableList
				.filter(
					(item) => item.startsWith('select::') && !item.includes('create::'),
				)
				.map((item) => item.split('::')[2])
				.filter((table) => table && !createdTables.includes(table));

			for (const tableName of createdTables) {
				dependencies.push({
					tableName,
					dependsOn: referencedTables,
				});
			}
		}

		return dependencies;
	};

	/**
	 * Build a dependency graph from SQL files
	 */
	buildDependencyGraph = (sqlFiles: SqlFile[]): DependencyGraph => {
		const graph: DependencyGraph = {
			nodes: new Set(),
			edges: new Map(),
			reversedEdges: new Map(),
		};

		// Add all tables as nodes and initialize edge maps
		for (const file of sqlFiles) {
			for (const dep of file.dependencies) {
				graph.nodes.add(dep.tableName);

				if (!graph.edges.has(dep.tableName)) {
					graph.edges.set(dep.tableName, new Set());
				}
				if (!graph.reversedEdges.has(dep.tableName)) {
					graph.reversedEdges.set(dep.tableName, new Set());
				}

				// Add dependencies as edges
				for (const dependsOn of dep.dependsOn) {
					graph.nodes.add(dependsOn);

					// table depends on dependsOn
					graph.edges.get(dep.tableName)!.add(dependsOn);

					// dependsOn is referenced by table
					if (!graph.reversedEdges.has(dependsOn)) {
						graph.reversedEdges.set(dependsOn, new Set());
					}
					graph.reversedEdges.get(dependsOn)!.add(dep.tableName);
				}
			}
		}

		return graph;
	};

	/**
	 * Detect circular dependencies using DFS
	 * Self-referencing tables (hierarchical structures) are not considered circular dependencies
	 */
	detectCycles = (graph: DependencyGraph): string[][] => {
		const visited = new Set<string>();
		const recursionStack = new Set<string>();
		const cycles: string[][] = [];

		const dfs = (node: string, path: string[]): boolean => {
			visited.add(node);
			recursionStack.add(node);
			path.push(node);

			const dependencies = graph.edges.get(node) || new Set();

			for (const dep of dependencies) {
				// Skip self-references - these are valid hierarchical structures
				if (dep === node) {
					continue;
				}

				if (!visited.has(dep)) {
					if (dfs(dep, [...path])) {
						return true;
					}
				} else if (recursionStack.has(dep)) {
					// Found a cycle
					const cycleStart = path.indexOf(dep);
					const cycle = path.slice(cycleStart);
					cycle.push(dep); // Complete the cycle
					cycles.push(cycle);
					return true;
				}
			}

			recursionStack.delete(node);
			path.pop();
			return false;
		};

		for (const node of graph.nodes) {
			if (!visited.has(node)) {
				dfs(node, []);
			}
		}

		return cycles;
	};

	/**
	 * Visualize the dependency graph
	 */
	visualizeDependencyGraph = (
		graph: DependencyGraph,
		cycles: string[][] = [],
	): void => {
		console.log('\n🔗 Dependency Graph:');
		console.log('='.repeat(50));

		// Show all nodes and their dependencies
		for (const node of Array.from(graph.nodes).sort()) {
			const deps = graph.edges.get(node) || new Set();
			const dependents = graph.reversedEdges.get(node) || new Set();

			console.log(`📊 Table: ${node}`);

			// Check for self-reference
			const hasSelfReference = deps.has(node);
			const nonSelfDeps = Array.from(deps).filter((dep) => dep !== node);

			if (nonSelfDeps.length > 0) {
				console.log(`  ➡️  Depends on: ${nonSelfDeps.sort().join(', ')}`);
			} else {
				console.log(`  ➡️  Depends on: (none)`);
			}

			if (hasSelfReference) {
				console.log(`  🔄 Self-referencing: ${node} (hierarchical structure)`);
			}

			if (dependents.size > 0) {
				console.log(
					`  ⬅️  Referenced by: ${Array.from(dependents).sort().join(', ')}`,
				);
			} else {
				console.log(`  ⬅️  Referenced by: (none)`);
			}

			console.log('');
		}

		// Show cycles if any
		if (cycles.length > 0) {
			console.log('🔄 Circular Dependencies Detected:');
			console.log('─'.repeat(30));
			cycles.forEach((cycle, index) => {
				console.log(`  ${index + 1}. ${cycle.join(' → ')}`);
			});
			console.log('');
		} else {
			console.log('✅ No circular dependencies detected');
			console.log('');
		}
	};

	/**
	 * Parse SQL files and extract table dependencies
	 * Phase 2: Actually parse SQL content using AST
	 */
	parseSqlFile = (
		directoryPath: string,
		dialect: SqlDialect = 'postgresql',
		options: { allowReorderDropComments?: boolean } = {},
	): SqlFile[] => {
		console.log(`🔍 Scanning directory: ${directoryPath}`);
		console.log(`📝 Using SQL dialect: ${dialect}`);

		// Find all SQL files in the directory
		const sqlFilePaths = this.findSqlFiles(directoryPath);

		console.log(`📁 Found ${sqlFilePaths.length} SQL files:`);
		sqlFilePaths.forEach((filePath) => console.log(`  - ${filePath}`));

		const sqlFiles: SqlFile[] = [];

		// Read and parse each SQL file
		for (const filePath of sqlFilePaths) {
			try {
				console.log(`\n📖 Reading file: ${filePath}`);
				
				// Use parseSingleFile to handle parsing (without validation)
				const sqlFile = this.parseSingleFile(filePath, dialect, options);
				
				console.log(`🏗️  Parsed AST:`, JSON.stringify(sqlFile.ast, null, 2));
				console.log(`🔗 Extracted dependencies:`, sqlFile.dependencies);

				sqlFiles.push(sqlFile);
			} catch (error) {
				console.error(`❌ Failed to parse file ${filePath}:`, error);
				throw new Error(`Failed to parse SQL file ${filePath}: ${error}`);
			}
		}

		console.log(`\n✅ Successfully processed ${sqlFiles.length} SQL files`);

		// Phase 3: Check for duplicate table names across files
		this.validateNoDuplicateTableNames(sqlFiles);

		// Phase 4: Build dependency graph and detect cycles
		console.log(`\n🔧 Building dependency graph...`);
		const graph = this.buildDependencyGraph(sqlFiles);
		const cycles = this.detectCycles(graph);

		this.visualizeDependencyGraph(graph, cycles);

		if (cycles.length > 0) {
			throw new Error(
				`Circular dependencies detected: ${cycles.map((cycle) => cycle.join(' → ')).join(', ')}`,
			);
		}

		// Phase 5: Validate statement order within files (if not bypassed)
		if (!options.allowReorderDropComments) {
			this.validateFileStatementOrder(sqlFiles);
		}

		return sqlFiles;
	};

	/**
	 * Validate statement order within files that contain multiple CREATE TABLE statements
	 */
	validateFileStatementOrder = (sqlFiles: SqlFile[]): void => {
		for (const file of sqlFiles) {
			// Only validate files with multiple CREATE TABLE statements
			if (file.dependencies.length <= 1) {
				continue;
			}

			// Extract the order of CREATE TABLE statements as they appear in the file
			const statements = Array.isArray(file.ast) ? file.ast : [file.ast];
			const createTableStatements = statements.filter(
				(stmt) => stmt?.type === 'create' && stmt?.keyword === 'table',
			);

			if (createTableStatements.length <= 1) {
				continue;
			}

			// Get the actual order of table names as they appear in the file
			const actualOrder: string[] = [];
			for (const stmt of createTableStatements) {
				const tableName = stmt.table?.[0]?.table || stmt.table?.table;
				if (tableName) {
					actualOrder.push(tableName);
				}
			}

			// Build a map of dependencies for quick lookup
			const depMap = new Map<string, string[]>();
			for (const dep of file.dependencies) {
				depMap.set(dep.tableName, dep.dependsOn);
			}

			// Validate that for each table, all its dependencies appear before it
			const seenTables = new Set<string>();
			for (const tableName of actualOrder) {
				const dependencies = depMap.get(tableName) || [];
				const missingDeps = dependencies.filter(
					dep => dep !== tableName && !seenTables.has(dep)
				);
				
				if (missingDeps.length > 0) {
					// Build the required order using basic topological principles
					const allTables = new Set(actualOrder);
					const requiredOrder: string[] = [];
					const visited = new Set<string>();
					const visiting = new Set<string>();
					
					const visit = (table: string) => {
						if (visiting.has(table)) {
							throw new Error(`Circular dependency involving ${table}`);
						}
						if (visited.has(table) || !allTables.has(table)) {
							return;
						}
						
						visiting.add(table);
						const deps = depMap.get(table) || [];
						for (const dep of deps) {
							if (dep !== table && allTables.has(dep)) {
								visit(dep);
							}
						}
						visiting.delete(table);
						visited.add(table);
						requiredOrder.push(table);
					};
					
					for (const table of actualOrder) {
						visit(table);
					}

					throw new Error(
						`File ${file.path} contains CREATE TABLE statements in incorrect dependency order.\n` +
							`Please reorder statements so dependencies come before dependents.\n` +
							`Current order: ${actualOrder.join(' → ')}\n` +
							`Required order: ${requiredOrder.join(' → ')}`,
					);
				}
				
				seenTables.add(tableName);
			}
		}
	};

	/**
	 * Parse a single SQL file
	 */
	parseSingleFile = (
		filePath: string,
		dialect: SqlDialect = 'postgresql',
		options: { allowReorderDropComments?: boolean } = {},
	): SqlFile => {
		try {
			const content = readFileSync(filePath, 'utf-8').trim();
			const { ast, dependencies } = this.parseStatement(content, dialect);

			return {
				path: filePath,
				content,
				ast,
				dependencies,
			};
		} catch (error) {
			throw new Error(`Failed to parse SQL file ${filePath}: ${error}`);
		}
	};

	/**
	 * Perform topological sort on SQL dependencies using Kahn's algorithm
	 * Self-references are excluded from in-degree calculation
	 */
	topologicalSort = (files: SqlFile[]): SqlFile[] => {
		// First build dependency graph
		const graph = this.buildDependencyGraph(files);

		// Check for cycles first
		const cycles = this.detectCycles(graph);
		if (cycles.length > 0) {
			throw new Error(
				`Cannot perform topological sort: circular dependencies detected: ${cycles.map((cycle) => cycle.join(' → ')).join(', ')}`,
			);
		}

		// Create a map from table name to SQL file for easy lookup
		const tableToFile = new Map<string, SqlFile>();
		for (const file of files) {
			for (const dep of file.dependencies) {
				tableToFile.set(dep.tableName, file);
			}
		}

		// Calculate in-degrees: how many tables each table depends on (excluding self-references)
		// If table A depends on table B, then A has an incoming edge (dependency)
		const inDegree = new Map<string, number>();
		for (const node of graph.nodes) {
			const dependencies = graph.edges.get(node) || new Set();
			// Filter out self-references - they don't affect topological ordering
			const nonSelfDependencies = Array.from(dependencies).filter(
				(dep) => dep !== node,
			);
			inDegree.set(node, nonSelfDependencies.length);
		}

		// Find all nodes with no dependencies (in-degree = 0)
		const queue: string[] = [];
		for (const [node, degree] of inDegree) {
			if (degree === 0) {
				queue.push(node);
			}
		}

		const sortedTables: string[] = [];

		// Kahn's algorithm
		while (queue.length > 0) {
			const current = queue.shift()!;
			sortedTables.push(current);

			// For each table that depends on the current table (reverse dependencies)
			const dependents = graph.reversedEdges.get(current) || new Set();
			for (const dependent of dependents) {
				// Skip self-references in dependency processing
				if (dependent === current) {
					continue;
				}

				// "Remove" the dependency by decreasing in-degree
				const currentDegree = inDegree.get(dependent) || 0;
				const newDegree = currentDegree - 1;
				inDegree.set(dependent, newDegree);

				// If this table now has no more dependencies, add it to queue
				if (newDegree === 0) {
					queue.push(dependent);
				}
			}
		}

		// Verify we processed all nodes (this should always be true since we check cycles first)
		if (sortedTables.length !== graph.nodes.size) {
			throw new Error(
				'Topological sort failed: not all nodes were processed (unexpected cycle detected)',
			);
		}

		// Convert sorted table names back to SQL files in correct order
		const sortedFiles: SqlFile[] = [];
		const processedFiles = new Set<SqlFile>();

		for (const tableName of sortedTables) {
			const file = tableToFile.get(tableName);
			if (file && !processedFiles.has(file)) {
				sortedFiles.push(file);
				processedFiles.add(file);
			}
		}

		console.log('\n🔄 Topological Sort Result:');
		console.log('='.repeat(40));
		sortedFiles.forEach((file, index) => {
			const fileName = file.path.split('/').pop();
			const tableNames = file.dependencies.map((d) => d.tableName).join(', ');
			console.log(`${index + 1}. ${fileName} (${tableNames})`);
		});
		console.log('');

		return sortedFiles;
	};

	/**
	 * Merge multiple SQL files into one with proper ordering
	 */
	mergeFiles = (
		files: SqlFile[],
		options: {
			addComments?: boolean;
			separateStatements?: boolean;
			includeHeader?: boolean;
			outputPath?: string; // New option for output file path
		} = {},
	): string => {
		const {
			addComments = true,
			separateStatements = true,
			includeHeader = true,
			outputPath,
		} = options;

		if (files.length === 0) {
			return '';
		}

		// First, topologically sort the files to ensure correct order
		const sortedFiles = this.topologicalSort(files);

		const parts: string[] = [];

		// Add header comment if requested
		if (includeHeader) {
			const timestamp = new Date().toISOString();
			const fileCount = sortedFiles.length;
			const header = `-- SQL Merger Output
-- Generated: ${timestamp}
-- Files merged: ${fileCount}
-- Order: ${sortedFiles.map((f) => f.path.split('/').pop()).join(' → ')}
`;
			parts.push(header);
		}

		// Process each file in topologically sorted order
		for (let i = 0; i < sortedFiles.length; i++) {
			const file = sortedFiles[i];
			const fileName = file.path.split('/').pop() || 'unknown';

			// Add file comment if requested
			if (addComments) {
				const tableNames = file.dependencies.map((d) => d.tableName).join(', ');
				const dependsOn = file.dependencies.flatMap((d) => d.dependsOn);
				const depsComment =
					dependsOn.length > 0
						? ` (depends on: ${dependsOn.join(', ')})`
						: ' (no dependencies)';

				const fileComment = `
-- ================================================================
-- File: ${fileName}${depsComment}
-- ================================================================`;
				parts.push(fileComment);
			}

			// Add the actual file content (preserving original formatting)
			let content = file.content.trim();

			// Ensure content ends with semicolon if it doesn't already
			if (!content.endsWith(';')) {
				content += ';';
			}

			parts.push(content);

			// Add separator between files if requested and not the last file
			if (separateStatements && i < sortedFiles.length - 1) {
				parts.push(''); // Empty line for separation
			}
		}

		const mergedContent = parts.join('\n');

		// Handle output
		if (outputPath) {
			// Write to file
			try {
				writeFileSync(outputPath, mergedContent, 'utf-8');
				console.log(`\n📁 Output written to: ${outputPath}`);
			} catch (error) {
				throw new Error(`Failed to write output file ${outputPath}: ${error}`);
			}
		} else {
			// Default to stdout when no output path is specified
			process.stdout.write(mergedContent);
			console.log('\n📤 Output written to stdout (default)');
		}

		console.log('\n📄 SQL Merge Complete:');
		console.log('='.repeat(40));
		console.log(`📁 Files processed: ${sortedFiles.length}`);
		console.log(`📝 Total lines: ${mergedContent.split('\n').length}`);
		console.log(`📊 Characters: ${mergedContent.length}`);
		if (outputPath) {
			console.log(`💾 Saved to: ${outputPath}`);
		} else {
			console.log(`📤 Output: stdout (default)`);
		}
		console.log('✅ Merge successful!');
		console.log('');

		return mergedContent;
	};

	/**
	 * Validate no duplicate table names across files
	 */
	validateNoDuplicateTableNames = (sqlFiles: SqlFile[]): void => {
		const tableToFile = new Map<string, string>();
		const duplicates: Array<{ tableName: string; files: string[] }> = [];

		// Collect all table names and their source files
		for (const file of sqlFiles) {
			for (const dep of file.dependencies) {
				const tableName = dep.tableName;
				const fileName = file.path.split('/').pop() || file.path;

				if (tableToFile.has(tableName)) {
					// Found a duplicate
					const existingFile = tableToFile.get(tableName)!;
					const existing = duplicates.find(d => d.tableName === tableName);
					
					if (existing) {
						// Add this file to existing duplicate entry
						if (!existing.files.includes(fileName)) {
							existing.files.push(fileName);
						}
					} else {
						// Create new duplicate entry
						duplicates.push({
							tableName,
							files: [existingFile, fileName]
						});
					}
				} else {
					tableToFile.set(tableName, fileName);
				}
			}
		}

		if (duplicates.length > 0) {
			const duplicateDetails = duplicates
				.map(d => `  • "${d.tableName}" defined in: ${d.files.join(', ')}`)
				.join('\n');

			throw new Error(
				`Duplicate table names detected across multiple files:\n${duplicateDetails}\n\n` +
				`Each table should only be defined once across all files in the directory.`
			);
		}
	};
}

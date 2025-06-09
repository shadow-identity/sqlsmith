#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { type SqlDialect, type SqlFile, SqlMerger } from './sql-merger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type CliOptions = {
	output?: string;
	dialect: string;
	comments: boolean;
	header: boolean;
	separate: boolean;
	quiet: boolean;
	verbose: boolean;
	allowReorderDropComments: boolean;
};

export type InfoOptions = {
	dialect: string;
	quiet: boolean;
};

export type ValidateOptions = {
	dialect: string;
	quiet: boolean;
};

/**
 * Main merge command implementation
 */
export const mergeCommand = async (
	inputPath: string,
	options: CliOptions,
): Promise<void> => {
	const startTime = Date.now();

	if (!options.quiet) {
		console.log('🔧 SQL Merger v1.0.0');
		console.log('='.repeat(50));
	}

	// Validate input directory
	const resolvedInput = resolve(inputPath);
	validateInputDirectory(resolvedInput);

	// Validate dialect
	const validDialects = ['postgresql', 'mysql', 'sqlite', 'bigquery'] as const;
	if (!validDialects.includes(options.dialect as any)) {
		throw new Error(
			`Invalid dialect: ${options.dialect}. Must be one of: ${validDialects.join(', ')}`,
		);
	}

	// Validate output path if provided
	if (options.output) {
		const resolvedOutput = resolve(options.output);
		const outputDir = dirname(resolvedOutput);

		if (!existsSync(outputDir)) {
			throw new Error(`Output directory does not exist: ${outputDir}`);
		}
	}

	if (!options.quiet) {
		console.log(`📁 Input directory: ${resolvedInput}`);
		console.log(`🗃️  SQL dialect: ${options.dialect}`);
		if (options.output) {
			console.log(`📄 Output file: ${resolve(options.output)}`);
		} else {
			console.log(`📤 Output: stdout`);
		}
		console.log('');
	}

	// Initialize merger and process files
	const merger = new SqlMerger();

	// Reduce console output if quiet mode
	if (options.quiet) {
		// Temporarily override console.log for merger operations
		const originalLog = console.log;
		console.log = () => {}; // Suppress logs

		try {
			const sqlFiles = merger.parseSqlFile(
				resolvedInput,
				options.dialect as SqlDialect,
				{
					allowReorderDropComments: options.allowReorderDropComments
				}
			);

			// Restore console.log before merging (merge has its own quiet-friendly output)
			console.log = originalLog;

			const mergeOptions = {
				addComments: options.comments !== false,
				includeHeader: options.header !== false,
				separateStatements: options.separate !== false,
				outputPath: options.output,
			};

			const merged = merger.mergeFiles(sqlFiles, mergeOptions);

			const duration = Date.now() - startTime;
			if (!options.quiet) {
				console.log(`⏱️  Completed in ${duration}ms`);
			}
		} catch (error) {
			console.log = originalLog; // Restore console.log on error
			throw error;
		}
	} else {
		// Normal verbose processing
		const sqlFiles = merger.parseSqlFile(
			resolvedInput,
			options.dialect as SqlDialect,
			{
				allowReorderDropComments: options.allowReorderDropComments
			}
		);

		const mergeOptions = {
			addComments: options.comments !== false,
			includeHeader: options.header !== false,
			separateStatements: options.separate !== false,
			outputPath: options.output,
		};

		const merged = merger.mergeFiles(sqlFiles, mergeOptions);

		const duration = Date.now() - startTime;
		console.log(`⏱️  Completed in ${duration}ms`);
	}
};

/**
 * Info command implementation - analyze dependencies without merging
 */
export const infoCommand = async (
	inputPath: string,
	options: InfoOptions,
): Promise<void> => {
	if (!options.quiet) {
		console.log('🔍 SQL Dependency Analyzer');
		console.log('='.repeat(50));
	}

	const resolvedInput = resolve(inputPath);
	validateInputDirectory(resolvedInput);

	const merger = new SqlMerger();

	// Parse files but catch circular dependency errors
	try {
		const sqlFiles = merger.parseSqlFile(
			resolvedInput,
			options.dialect as SqlDialect,
		);

		if (!options.quiet) {
			console.log(`✅ Analysis complete - no circular dependencies detected`);
			console.log(
				`📊 Found ${sqlFiles.length} SQL files with valid dependencies`,
			);
		}

		// Show topological order
		const sorted = merger.topologicalSort(sqlFiles);
		console.log('\n📋 Recommended execution order:');
		sorted.forEach((file, index) => {
			const fileName = file.path.split('/').pop();
			const tables = file.dependencies.map((d) => d.tableName).join(', ');
			const deps = file.dependencies.flatMap((d) => d.dependsOn);
			const depsText =
				deps.length > 0
					? ` (depends on: ${deps.join(', ')})`
					: ' (no dependencies)';
			console.log(`  ${index + 1}. ${fileName} - ${tables}${depsText}`);
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes('Circular dependencies detected')) {
			console.log(
				'❌ Circular dependencies detected - cannot determine safe execution order',
			);

			// Still try to show the dependency graph visualization
			try {
				const files: SqlFile[] = [];
				const filePaths = merger.findSqlFiles(resolvedInput);
				for (const filePath of filePaths) {
					files.push(
						merger.parseSingleFile(filePath, options.dialect as SqlDialect, {}),
					);
				}

				const graph = merger.buildDependencyGraph(files);
				const cycles = merger.detectCycles(graph);
				merger.visualizeDependencyGraph(graph, cycles);
			} catch (vizError) {
				// If we can't visualize, just show the original error
			}

			throw error;
		} else {
			throw error;
		}
	}
};

/**
 * Validate command implementation - check syntax and dependencies
 */
export const validateCommand = async (
	inputPath: string,
	options: ValidateOptions,
): Promise<void> => {
	if (!options.quiet) {
		console.log('✅ SQL Validator');
		console.log('='.repeat(50));
	}

	const resolvedInput = resolve(inputPath);
	validateInputDirectory(resolvedInput);

	const merger = new SqlMerger();
	let hasErrors = false;
	let totalFiles = 0;
	let validFiles = 0;

	try {
		// Find all SQL files
		const filePaths = merger.findSqlFiles(resolvedInput);
		totalFiles = filePaths.length;

		if (!options.quiet) {
			console.log(`📁 Found ${totalFiles} SQL files to validate`);
			console.log('');
		}

		// Validate each file individually first
		const files: SqlFile[] = [];
		for (const filePath of filePaths) {
			try {
				const file = merger.parseSingleFile(
					filePath,
					options.dialect as SqlDialect,
					{},
				);
				files.push(file);
				validFiles++;

				if (!options.quiet) {
					const fileName = filePath.split('/').pop();
					const tables = file.dependencies.map((d) => d.tableName).join(', ');
					console.log(`✅ ${fileName} - ${tables || 'no tables'}`);
				}
			} catch (error) {
				hasErrors = true;
				const fileName = filePath.split('/').pop();
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(`❌ ${fileName}: ${errorMessage}`);
			}
		}

		if (hasErrors) {
			console.log(
				`\n❌ Validation failed: ${totalFiles - validFiles} files have syntax errors`,
			);
			process.exit(1);
		}

		// Check for circular dependencies
		try {
			const graph = merger.buildDependencyGraph(files);
			const cycles = merger.detectCycles(graph);

			if (cycles.length > 0) {
				console.log(`\n❌ Circular dependencies detected:`);
				cycles.forEach((cycle, index) => {
					console.log(`  ${index + 1}. ${cycle.join(' → ')}`);
				});
				process.exit(1);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (errorMessage.includes('Circular dependencies detected')) {
				console.log(`\n❌ ${errorMessage}`);
				process.exit(1);
			}
			throw error;
		}

		console.log(`\n✅ All ${validFiles} SQL files are valid`);
		console.log(`✅ No circular dependencies detected`);
		console.log(`✅ Ready for merging`);
	} catch (error) {
		throw error;
	}
};

/**
 * Validate input directory exists and is readable
 */
export const validateInputDirectory = (inputPath: string): void => {
	if (!existsSync(inputPath)) {
		throw new Error(`Input directory does not exist: ${inputPath}`);
	}

	const stats = statSync(inputPath);
	if (!stats.isDirectory()) {
		throw new Error(`Input path is not a directory: ${inputPath}`);
	}

	// Try to read the directory to check permissions
	try {
		const merger = new SqlMerger();
		merger.findSqlFiles(inputPath);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Cannot read input directory: ${errorMessage}`);
	}
};

/**
 * Create and configure the CLI program
 */
export const createProgram = (): Command => {
	const program = new Command();

	// Package info
	program
		.name('sql-merger')
		.description('A tool for merging SQL files with dependency resolution')
		.version('1.0.0');

	// Main merge command
	program
		.argument('<input>', 'Input directory containing SQL files')
		.option('-o, --output <path>', 'Output file path (default: stdout)')
		.option('-d, --dialect <dialect>', 'SQL dialect (postgresql, mysql, sqlite, bigquery)', 'postgresql')
		.option('--no-comments', 'Disable file comments in output')
		.option('--no-header', 'Disable header comment in output')
		.option('--no-separate', 'Disable statement separation')
		.option('--allow-reorder-drop-comments', 'Allow reordering statements within files (drops comments)')
		.option('--quiet', 'Reduce console output')
		.option('--verbose', 'Increase console output for debugging')
		.action(async (input: string, options: CliOptions) => {
			try {
				await mergeCommand(input, options);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(`❌ Error: ${errorMessage}`);
				process.exit(1);
			}
		});

	// Info command for analyzing dependencies without merging
	program
		.command('info')
		.description('Analyze SQL file dependencies without merging')
		.argument('<input>', 'Input directory containing SQL files')
		.option(
			'-d, --dialect <dialect>',
			'SQL dialect (postgresql, mysql, sqlite, bigquery)',
			'postgresql',
		)
		.option('--quiet', 'Reduce console output')
		.action(async (input: string, options: InfoOptions) => {
			try {
				await infoCommand(input, options);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(`❌ Error: ${errorMessage}`);
				process.exit(1);
			}
		});

	// Validate command for checking SQL syntax and dependencies
	program
		.command('validate')
		.description('Validate SQL files and check for circular dependencies')
		.argument('<input>', 'Input directory containing SQL files')
		.option(
			'-d, --dialect <dialect>',
			'SQL dialect (postgresql, mysql, sqlite, bigquery)',
			'postgresql',
		)
		.option('--quiet', 'Reduce console output')
		.action(async (input: string, options: ValidateOptions) => {
			try {
				await validateCommand(input, options);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(`❌ Error: ${errorMessage}`);
				process.exit(1);
			}
		});

	return program;
};

/**
 * Handle uncaught errors gracefully
 */
process.on('uncaughtException', (error: Error) => {
	console.error(`❌ Unexpected error: ${error.message}`);
	if (process.env.NODE_ENV === 'development') {
		console.error(error.stack);
	}
	process.exit(1);
});

process.on(
	'unhandledRejection',
	(reason: unknown, promise: Promise<unknown>) => {
		console.error(`❌ Unhandled rejection at:`, promise, `reason:`, reason);
		process.exit(1);
	},
);

// Only run the CLI when this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
	const program = createProgram();
	program.parse();
}

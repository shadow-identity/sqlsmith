#!/usr/bin/env node
import { ErrorHandler, Logger } from '@sqlsmith/core';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { executeInfoCommand, executeMergeCommand, executeValidateCommand, } from './cli/commands/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Read version from package.json
const getVersion = () => {
    const packageJsonPath = resolve(__dirname, '../package.json');
    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (!packageJson?.version || typeof packageJson.version !== 'string') {
            throw new Error('No valid version found in package.json');
        }
        return packageJson.version;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read version from package.json: ${message}`);
    }
};
const VERSION = getVersion();
/**
 * Handle command errors with consistent formatting
 */
const handleCommandError = (error, quiet) => {
    const logger = new Logger({ quiet });
    const errorHandler = new ErrorHandler(logger);
    errorHandler.handleCommandError(error, quiet);
};
/**
 * Create and configure the CLI program
 */
export const createProgram = () => {
    const program = new Command();
    // Package info
    program
        .name('sqlsmith')
        .description('A tool for merging SQL files with dependency resolution')
        .version(VERSION);
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
        .action(async (input, options) => {
        try {
            await executeMergeCommand(input, options);
        }
        catch (error) {
            handleCommandError(error, options.quiet);
        }
    });
    // Info command
    program
        .command('info')
        .description('Analyze SQL file dependencies without merging')
        .argument('<input>', 'Input directory containing SQL files')
        .option('-d, --dialect <dialect>', 'SQL dialect (postgresql, mysql, sqlite, bigquery)', 'postgresql')
        .option('--quiet', 'Reduce console output')
        .action(async (input, options) => {
        try {
            await executeInfoCommand(input, options);
        }
        catch (error) {
            handleCommandError(error, options.quiet);
        }
    });
    // Validate command
    program
        .command('validate')
        .description('Validate SQL files and check for circular dependencies')
        .argument('<input>', 'Input directory containing SQL files')
        .option('-d, --dialect <dialect>', 'SQL dialect (postgresql, mysql, sqlite, bigquery)', 'postgresql')
        .option('--quiet', 'Reduce console output')
        .action(async (input, options) => {
        try {
            await executeValidateCommand(input, options);
        }
        catch (error) {
            handleCommandError(error, options.quiet);
        }
    });
    return program;
};
/**
 * Main CLI entry point
 */
export const main = async () => {
    const program = createProgram();
    await program.parseAsync();
};
// If this module is run directly, execute the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        const logger = new Logger();
        const errorHandler = new ErrorHandler(logger);
        errorHandler.handleCommandError(error);
    });
}
//# sourceMappingURL=cli.js.map
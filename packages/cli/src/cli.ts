#!/usr/bin/env node

import { ErrorHandler, Logger } from '@sqlsmith/core';
import { Command, Option } from 'commander';
import {
	executeInfoCommand,
	executeMergeCommand,
	executeValidateCommand,
	type InfoCommandOptions,
	type MergeCommandOptions,
	type ValidateCommandOptions,
} from './commands/index.js';
import {
	getVersion,
	handleCommandError,
	prepareContext,
	validateLogLevel,
} from './utils.js';

const VERSION = getVersion();

/**
 * Create and configure the CLI program
 */
export const createProgram = (): Command => {
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
		.option(
			'-d, --dialect <dialect>',
			'SQL dialect (postgresql, mysql, sqlite, bigquery)',
			'postgresql',
		)
		.option(
			'--allow-reorder-drop-comments',
			'Allow reordering statements within files (drops comments)',
		)
		.addOption(
			new Option('--log-level <level>', 'Set log level')
				.choices(['error', 'warn', 'info', 'debug'])
				.default('info'),
		)
		.action(async (input: string, options: MergeCommandOptions) => {
			try {
				const { resolvedInput, resolvedOutput, logLevel } = prepareContext(
					input,
					options,
				);

				await executeMergeCommand(resolvedInput, {
					...options,
					output: resolvedOutput,
					logLevel,
				});
			} catch (error) {
				handleCommandError(error, validateLogLevel(options.logLevel));
			}
		});

	// Info command
	program
		.command('info')
		.description('Analyze SQL file dependencies without merging')
		.argument('<input>', 'Input directory containing SQL files')
		.option(
			'-d, --dialect <dialect>',
			'SQL dialect (postgresql, mysql, sqlite, bigquery)',
			'postgresql',
		)
		.addOption(
			new Option('--log-level <level>', 'Set log level')
				.choices(['error', 'warn', 'info', 'debug'])
				.default('info'),
		)
		.action(async (input: string, options: InfoCommandOptions) => {
			try {
				const { resolvedInput, logLevel } = prepareContext(input, options);

				await executeInfoCommand(resolvedInput, { ...options, logLevel });
			} catch (error) {
				handleCommandError(error, validateLogLevel(options.logLevel));
			}
		});

	// Validate command
	program
		.command('validate')
		.description('Validate SQL files and check for circular dependencies')
		.argument('<input>', 'Input directory containing SQL files')
		.option(
			'-d, --dialect <dialect>',
			'SQL dialect (postgresql, mysql, sqlite, bigquery)',
			'postgresql',
		)
		.addOption(
			new Option('--log-level <level>', 'Set log level')
				.choices(['error', 'warn', 'info', 'debug'])
				.default('info'),
		)
		.action(async (input: string, options: ValidateCommandOptions) => {
			try {
				const { resolvedInput, logLevel } = prepareContext(input, options);

				await executeValidateCommand(resolvedInput, { ...options, logLevel });
			} catch (error) {
				handleCommandError(error, validateLogLevel(options.logLevel));
			}
		});

	return program;
};

/**
 * Main CLI entry point
 */
export const main = async (): Promise<void> => {
	const program = createProgram();
	await program.parseAsync();
};

// If this module is run directly, execute the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		const logger = new Logger({ logLevel: 'info' });
		const errorHandler = new ErrorHandler(logger);
		errorHandler.handleCommandError(error);
	});
}

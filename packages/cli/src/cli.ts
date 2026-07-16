#!/usr/bin/env node

import { SUPPORTED_DIALECTS } from '@sqlsmith/core';
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
const DIALECT_HELP = `SQL dialect (${SUPPORTED_DIALECTS.join(', ')})`;

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
		.option('-d, --dialect <dialect>', DIALECT_HELP, 'postgresql')
		.option(
			'--no-validate-source-order',
			'Skip validation that statements within a file are declared before their dependents',
		)
		.option(
			'--allow-external-references',
			'Allow foreign keys referencing tables outside the input files',
		)
		.option(
			'--default-schema <schema>',
			'Schema assigned to unqualified relation names (PostgreSQL default: public)',
		)
		.addOption(
			new Option('--log-level <level>', 'Set log level')
				.choices(['silent', 'error', 'warn', 'info', 'debug'])
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
		.option('-d, --dialect <dialect>', DIALECT_HELP, 'postgresql')
		.option(
			'--allow-external-references',
			'Allow foreign keys referencing tables outside the input files',
		)
		.option(
			'--default-schema <schema>',
			'Schema assigned to unqualified relation names (PostgreSQL default: public)',
		)
		.addOption(
			new Option('--log-level <level>', 'Set log level')
				.choices(['silent', 'error', 'warn', 'info', 'debug'])
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
		.option('-d, --dialect <dialect>', DIALECT_HELP, 'postgresql')
		.option(
			'--allow-external-references',
			'Allow foreign keys referencing tables outside the input files',
		)
		.option(
			'--default-schema <schema>',
			'Schema assigned to unqualified relation names (PostgreSQL default: public)',
		)
		.addOption(
			new Option('--log-level <level>', 'Set log level')
				.choices(['silent', 'error', 'warn', 'info', 'debug'])
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
		handleCommandError(error, 'info');
	});
}

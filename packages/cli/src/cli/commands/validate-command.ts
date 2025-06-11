import { ServiceContainer, type SqlDialect, SqlMerger } from '@sqlsmith/core';
import { resolve } from 'path';

export type ValidateCommandOptions = {
	dialect: string;
	quiet: boolean;
};

/**
 * Validate command implementation - check syntax and dependencies
 */
export const executeValidateCommand = async (
	inputPath: string,
	options: ValidateCommandOptions,
): Promise<void> => {
	const container = new ServiceContainer({
		loggerOptions: {
			logLevel: options.quiet ? 'error' : 'info',
		},
	});

	const logger = container.getLogger();
	const validator = container.getFileSystemValidator();

	// Resolve and validate input path
	const resolvedInput = resolve(inputPath);
	validator.validateInputDirectory(resolvedInput);

	// Validate dialect
	validator.validateDialect(options.dialect);

	// Create merger with container
	const merger = SqlMerger.withContainer(container);

	try {
		merger.validateFiles(resolvedInput, options.dialect as SqlDialect);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Validation failed: ${errorMessage}`);
		throw error;
	}
};

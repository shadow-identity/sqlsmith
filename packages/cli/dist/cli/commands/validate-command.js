import { ServiceContainer, SqlMerger } from '@sqlsmith/core';
import { resolve } from 'path';
/**
 * Validate command implementation - check syntax and dependencies
 */
export const executeValidateCommand = async (inputPath, options) => {
    const container = new ServiceContainer({
        loggerOptions: {
            quiet: options.quiet,
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
        merger.validateFiles(resolvedInput, options.dialect);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Validation failed: ${errorMessage}`);
        throw error;
    }
};
//# sourceMappingURL=validate-command.js.map
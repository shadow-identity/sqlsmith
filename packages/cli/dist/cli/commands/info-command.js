import { ServiceContainer, SqlMerger } from '@sqlsmith/core';
import { resolve } from 'path';
/**
 * Info command implementation - analyze dependencies
 */
export const executeInfoCommand = async (inputPath, options) => {
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
        merger.analyzeDependencies(resolvedInput, options.dialect);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Circular dependencies detected')) {
            logger.error('Circular dependencies detected - cannot determine safe execution order');
            // For circular dependencies, we still want to show what we can
            logger.raw('\n' + errorMessage);
            throw error;
        }
        else {
            throw error;
        }
    }
};
//# sourceMappingURL=info-command.js.map
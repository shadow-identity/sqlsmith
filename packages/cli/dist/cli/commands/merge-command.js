import { ConfigurationError, ServiceContainer, SqlMerger, } from '@sqlsmith/core';
import { resolve } from 'path';
const SUPPORTED_DIALECTS = [
    'postgresql',
    'mysql',
    'sqlite',
    'bigquery',
];
/**
 * Validate dialect option
 */
const validateDialect = (dialect) => {
    if (!SUPPORTED_DIALECTS.includes(dialect)) {
        throw ConfigurationError.invalidOptions('dialect', `${dialect}. Supported dialects: ${SUPPORTED_DIALECTS.join(', ')}`);
    }
    return dialect;
};
/**
 * Merge command implementation
 */
export const executeMergeCommand = async (inputPath, options) => {
    // Convert CLI flags to logLevel
    let logLevel = 'info';
    if (options.quiet) {
        logLevel = 'error';
    }
    else if (options.verbose) {
        logLevel = 'debug';
    }
    const container = new ServiceContainer({
        loggerOptions: {
            logLevel,
        },
        allowReorderDropComments: options.allowReorderDropComments ?? false,
    });
    const logger = container.getLogger();
    const validator = container.getFileSystemValidator();
    logger.info(`🔧 SQL Merger`);
    const resolvedInput = resolve(inputPath);
    validator.validateInputDirectory(resolvedInput);
    if (options.output) {
        validator.validateOutputDirectory(resolve(options.output));
    }
    const dialect = validateDialect(options.dialect);
    const merger = SqlMerger.withContainer(container);
    const sqlFiles = merger.parseSqlFile(resolvedInput, dialect);
    merger.mergeFiles(sqlFiles, {
        addComments: options.comments,
        includeHeader: options.header,
        separateStatements: options.separate,
        outputPath: options.output,
    });
    logger.success('Merge completed successfully');
};
//# sourceMappingURL=merge-command.js.map
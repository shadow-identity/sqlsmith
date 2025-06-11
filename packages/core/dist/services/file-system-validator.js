import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname } from 'node:path';
export class FileSystemValidator {
    /**
     * Validate that input directory exists and is readable
     */
    validateInputDirectory = (inputPath) => {
        if (!existsSync(inputPath)) {
            throw new Error(`Input directory does not exist: ${inputPath}`);
        }
        const stats = statSync(inputPath);
        if (!stats.isDirectory()) {
            throw new Error(`Input path is not a directory: ${inputPath}`);
        }
        // Try to read the directory to catch permission errors
        try {
            readdirSync(inputPath);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Cannot read input directory: ${errorMessage}`);
        }
        // Check if directory contains any SQL files
        try {
            const files = readdirSync(inputPath, { withFileTypes: true });
            const sqlFiles = files.filter((file) => file.isFile() && extname(file.name).toLowerCase() === '.sql');
            if (sqlFiles.length === 0) {
                throw new Error(`No SQL files found in directory: ${inputPath}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Cannot read input directory: ${errorMessage}`);
        }
    };
    /**
     * Validate that output directory exists (if output path is provided)
     */
    validateOutputDirectory = (outputPath) => {
        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
            throw new Error(`Output directory does not exist: ${outputDir}`);
        }
    };
    /**
     * Validate SQL dialect
     */
    validateDialect = (dialect) => {
        const validDialects = ['postgresql', 'mysql', 'sqlite', 'bigquery'];
        if (!validDialects.includes(dialect)) {
            throw new Error(`Invalid dialect: ${dialect}. Must be one of: ${validDialects.join(', ')}`);
        }
    };
}
//# sourceMappingURL=file-system-validator.js.map
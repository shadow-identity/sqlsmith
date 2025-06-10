export declare class FileSystemValidator {
    /**
     * Validate that input directory exists and is readable
     */
    validateInputDirectory: (inputPath: string) => void;
    /**
     * Validate that output directory exists (if output path is provided)
     */
    validateOutputDirectory: (outputPath: string) => void;
    /**
     * Validate SQL dialect
     */
    validateDialect: (dialect: string) => void;
}
//# sourceMappingURL=file-system-validator.d.ts.map
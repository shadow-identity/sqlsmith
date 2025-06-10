export type ValidateCommandOptions = {
    dialect: string;
    quiet: boolean;
};
/**
 * Validate command implementation - check syntax and dependencies
 */
export declare const executeValidateCommand: (inputPath: string, options: ValidateCommandOptions) => Promise<void>;
//# sourceMappingURL=validate-command.d.ts.map
export type MergeCommandOptions = {
    output?: string;
    dialect: string;
    comments: boolean;
    header: boolean;
    separate: boolean;
    quiet: boolean;
    verbose: boolean;
    allowReorderDropComments?: boolean;
};
/**
 * Merge command implementation
 */
export declare const executeMergeCommand: (inputPath: string, options: MergeCommandOptions) => Promise<void>;
//# sourceMappingURL=merge-command.d.ts.map
#!/usr/bin/env node
import { Command } from 'commander';
export type CliOptions = {
    output?: string;
    dialect: string;
    comments: boolean;
    header: boolean;
    separate: boolean;
    quiet: boolean;
    verbose: boolean;
    allowReorderDropComments: boolean;
};
export type InfoOptions = {
    dialect: string;
    quiet: boolean;
};
export type ValidateOptions = {
    dialect: string;
    quiet: boolean;
};
/**
 * Main merge command implementation
 */
export declare const mergeCommand: (inputPath: string, options: CliOptions) => Promise<void>;
/**
 * Info command implementation - analyze dependencies without merging
 */
export declare const infoCommand: (inputPath: string, options: InfoOptions) => Promise<void>;
/**
 * Validate command implementation - check syntax and dependencies
 */
export declare const validateCommand: (inputPath: string, options: ValidateOptions) => Promise<void>;
/**
 * Validate input directory exists and is readable
 */
export declare const validateInputDirectory: (inputPath: string) => void;
/**
 * Create and configure the CLI program
 */
export declare const createProgram: () => Command;
//# sourceMappingURL=cli.d.ts.map
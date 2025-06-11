import { ErrorHandler, type LogLevel } from '@sqlsmith/core';
import { Command, Option } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram, main } from './cli.js';
import {
	executeInfoCommand,
	executeMergeCommand,
	executeValidateCommand,
} from './commands/index.js';
import {
	getVersion,
	handleCommandError,
	prepareContext,
	validateLogLevel,
} from './utils.js';

// Mock dependencies
vi.mock('./utils.js');
vi.mock('./commands/index.js');
vi.mock('commander');
vi.mock('@sqlsmith/core');

describe('CLI', () => {
	const mockGetVersion = vi.mocked(getVersion);
	const mockPrepareContext = vi.mocked(prepareContext);
	const mockValidateLogLevel = vi.mocked(validateLogLevel);
	const mockHandleCommandError = vi.mocked(handleCommandError);
	const mockExecuteMergeCommand = vi.mocked(executeMergeCommand);
	const mockExecuteInfoCommand = vi.mocked(executeInfoCommand);
	const mockExecuteValidateCommand = vi.mocked(executeValidateCommand);
	const MockedCommand = vi.mocked(Command);
	const MockedOption = vi.mocked(Option);
	const MockedErrorHandler = vi.mocked(ErrorHandler);

	let mergeAction: (input: string, options: any) => Promise<void>;
	let infoAction: (input: string, options: any) => Promise<void>;
	let validateAction: (input: string, options: any) => Promise<void>;
	let programMock: any;

	beforeEach(() => {
		vi.resetAllMocks();

		const subCommandMock = (name: string) => ({
			description: vi.fn().mockReturnThis(),
			argument: vi.fn().mockReturnThis(),
			option: vi.fn().mockReturnThis(),
			addOption: vi.fn().mockReturnThis(),
			action: vi.fn((action) => {
				if (name === 'info') infoAction = action;
				if (name === 'validate') validateAction = action;
			}),
		});

		programMock = {
			name: vi.fn().mockReturnThis(),
			description: vi.fn().mockReturnThis(),
			version: vi.fn().mockReturnThis(),
			argument: vi.fn().mockReturnThis(),
			option: vi.fn().mockReturnThis(),
			addOption: vi.fn().mockReturnThis(),
			action: vi.fn((action) => {
				mergeAction = action;
				return programMock;
			}),
			command: vi.fn((name) => subCommandMock(name)),
			parseAsync: vi.fn().mockResolvedValue(undefined),
		};

		MockedCommand.mockReturnValue(programMock);
		MockedOption.mockImplementation(
			() =>
				({
					choices: vi.fn().mockReturnThis(),
					default: vi.fn().mockReturnThis(),
				}) as any,
		);

		// Call createProgram to set up the commands and capture the actions
		createProgram();

		// Setup default mock implementations
		mockGetVersion.mockReturnValue('1.0.0-test');
		mockPrepareContext.mockImplementation((input, options) => ({
			resolvedInput: `/resolved/${input}`,
			resolvedOutput: options.output
				? `/resolved/${options.output}`
				: undefined,
			logLevel: options.logLevel as LogLevel,
		}));
		mockValidateLogLevel.mockImplementation(
			(level) => (level ?? 'info') as LogLevel,
		);
		mockExecuteMergeCommand.mockResolvedValue(undefined);
		mockExecuteInfoCommand.mockResolvedValue(undefined);
		mockExecuteValidateCommand.mockResolvedValue(undefined);
		MockedErrorHandler.mockImplementation(
			() =>
				({
					handleCommandError: vi.fn(),
				}) as any,
		);
	});

	describe('merge command', () => {
		it('should call executeMergeCommand with correct options on success', async () => {
			const input = 'my-sql-files';
			const options = {
				output: 'merged.sql',
				dialect: 'postgresql' as const,
				logLevel: 'info' as LogLevel,
				allowReorderDropComments: true,
			};

			const { resolvedInput, resolvedOutput, logLevel } = mockPrepareContext(
				input,
				options,
			);

			await mergeAction(input, options);

			expect(mockPrepareContext).toHaveBeenCalledWith(input, options);
			expect(mockExecuteMergeCommand).toHaveBeenCalledWith(resolvedInput, {
				...options,
				output: resolvedOutput,
				logLevel: logLevel,
			});
			expect(mockHandleCommandError).not.toHaveBeenCalled();
		});

		it('should call handleCommandError on failure', async () => {
			const input = 'my-sql-files';
			const options = { logLevel: 'error' as LogLevel };
			const error = new Error('Merge failed');
			mockExecuteMergeCommand.mockRejectedValue(error);
			const validatedLevel = mockValidateLogLevel(options.logLevel);

			await mergeAction(input, options);

			expect(mockPrepareContext).toHaveBeenCalledWith(input, options);
			expect(mockValidateLogLevel).toHaveBeenCalledWith('error');
			expect(mockHandleCommandError).toHaveBeenCalledWith(
				error,
				validatedLevel,
			);
		});
	});

	describe('info command', () => {
		it('should call executeInfoCommand with correct options on success', async () => {
			const input = 'info-sql-files';
			const options = {
				dialect: 'mysql' as const,
				logLevel: 'debug' as LogLevel,
			};
			const { resolvedInput, logLevel } = mockPrepareContext(input, options);

			await infoAction(input, options);

			expect(mockPrepareContext).toHaveBeenCalledWith(input, options);
			expect(mockExecuteInfoCommand).toHaveBeenCalledWith(resolvedInput, {
				...options,
				logLevel,
			});
			expect(mockHandleCommandError).not.toHaveBeenCalled();
		});

		it('should call handleCommandError on failure', async () => {
			const input = 'info-sql-files';
			const options = { logLevel: 'warn' as LogLevel };
			const error = new Error('Info failed');
			mockExecuteInfoCommand.mockRejectedValue(error);
			const validatedLevel = mockValidateLogLevel(options.logLevel);

			await infoAction(input, options);

			expect(mockPrepareContext).toHaveBeenCalledWith(input, options);
			expect(mockValidateLogLevel).toHaveBeenCalledWith('warn');
			expect(mockHandleCommandError).toHaveBeenCalledWith(
				error,
				validatedLevel,
			);
		});
	});

	describe('validate command', () => {
		it('should call executeValidateCommand with correct options on success', async () => {
			const input = 'validate-sql-files';
			const options = {
				dialect: 'sqlite' as const,
				logLevel: 'error' as LogLevel,
			};
			const { resolvedInput, logLevel } = mockPrepareContext(input, options);

			await validateAction(input, options);

			expect(mockPrepareContext).toHaveBeenCalledWith(input, options);
			expect(mockExecuteValidateCommand).toHaveBeenCalledWith(resolvedInput, {
				...options,
				logLevel,
			});
			expect(mockHandleCommandError).not.toHaveBeenCalled();
		});

		it('should call handleCommandError on failure', async () => {
			const input = 'validate-sql-files';
			const options = { logLevel: 'info' as LogLevel };
			const error = new Error('Validation failed');
			mockExecuteValidateCommand.mockRejectedValue(error);
			const validatedLevel = mockValidateLogLevel(options.logLevel);

			await validateAction(input, options);

			expect(mockPrepareContext).toHaveBeenCalledWith(input, options);
			expect(mockValidateLogLevel).toHaveBeenCalledWith('info');
			expect(mockHandleCommandError).toHaveBeenCalledWith(
				error,
				validatedLevel,
			);
		});
	});

	describe('main', () => {
		it('should create and parse the program', async () => {
			await main();
			expect(MockedCommand).toHaveBeenCalledTimes(2);
			expect(programMock.parseAsync).toHaveBeenCalledTimes(1);
		});
	});
});

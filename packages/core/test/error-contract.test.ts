import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AST } from 'node-sql-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatementProcessor } from '../src/processors/base-processor.js';
import { Logger } from '../src/services/logger.js';
import { SqlFileParser } from '../src/services/sql-file-parser.js';
import { SqlMerger } from '../src/sql-merger.js';
import {
	ErrorCode,
	type FileSystemError,
	ParsingError,
	ProcessingError,
} from '../src/types/errors.js';

// C3-TYPED-PARSE / C3-TYPED-FS / R3-01 / R3-02 / R3-04
describe('typed error boundary', () => {
	let scratchDir: string;

	beforeEach(() => {
		scratchDir = mkdtempSync(join(tmpdir(), 'sqlsmith-errors-'));
	});

	afterEach(() => {
		rmSync(scratchDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it('throws ParsingError with the source path, starting line, and cause without logging it', () => {
		const filePath = join(scratchDir, 'broken.sql');
		writeFileSync(
			filePath,
			'CREATE TABLE valid (id int);\n\nCREATE TABLE broken (;\n',
			'utf8',
		);
		const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
		const merger = new SqlMerger({
			logger: new Logger({ logLevel: 'error' }),
		});

		try {
			merger.parseSingleFile(filePath, 'postgresql');
			expect.fail('expected malformed SQL to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ParsingError);
			expect(error).toMatchObject({
				code: ErrorCode.INVALID_SQL_SYNTAX,
				context: {
					filePath,
					lineNumber: 3,
				},
			});
			expect((error as ParsingError).originalError).toBeInstanceOf(Error);
		}

		expect(stderr).not.toHaveBeenCalled();
	});

	it('throws FileSystemError for a missing input directory', () => {
		const missingPath = join(scratchDir, 'missing');
		const merger = new SqlMerger({
			logger: new Logger({ logLevel: 'error' }),
		});

		expect(() => merger.parseSqlFiles(missingPath, 'postgresql')).toThrowError(
			expect.objectContaining({
				code: ErrorCode.DIRECTORY_NOT_FOUND,
				context: { path: missingPath },
			}) as FileSystemError,
		);
	});

	it('throws FileSystemError for a missing SQL file', () => {
		const missingPath = join(scratchDir, 'missing.sql');
		const merger = new SqlMerger({
			logger: new Logger({ logLevel: 'error' }),
		});

		expect(() =>
			merger.parseSingleFile(missingPath, 'postgresql'),
		).toThrowError(
			expect.objectContaining({
				code: ErrorCode.FILE_NOT_FOUND,
				context: { path: missingPath },
			}) as FileSystemError,
		);
	});

	it('wraps custom processor failures with processor, file, and line context', () => {
		const filePath = join(scratchDir, 'processor.sql');
		writeFileSync(filePath, 'CREATE TABLE users (id int);\n', 'utf8');
		const originalError = new Error('processor sentinel');
		class FailingProcessor implements StatementProcessor {
			getHandledTypes(): string[] {
				return ['failing'];
			}

			canProcess(): boolean {
				return true;
			}

			extractStatements(_ast: AST | AST[], _filePath: string): never {
				throw originalError;
			}
		}
		const parser = new SqlFileParser([new FailingProcessor()]);

		try {
			parser.parseFile(filePath, 'postgresql');
			expect.fail('expected processor failure');
		} catch (error) {
			expect(error).toBeInstanceOf(ProcessingError);
			expect(error).toMatchObject({
				code: ErrorCode.PROCESSOR_ERROR,
				context: {
					processorName: 'FailingProcessor',
					filePath,
					lineNumber: 1,
				},
				originalError,
			});
		}
	});
});

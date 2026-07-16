import type { Dirent, Stats } from 'node:fs';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import { isSupportedDialect } from '../types/dialect.js';
import { ConfigurationError, FileSystemError } from '../types/errors.js';

export class FileSystemValidator {
	/**
	 * Validate that input directory exists and is readable
	 */
	validateInputDirectory = (inputPath: string): void => {
		if (!existsSync(inputPath)) {
			throw FileSystemError.directoryNotFound(inputPath);
		}

		let stats: Stats;
		try {
			stats = statSync(inputPath);
		} catch (error: unknown) {
			throw FileSystemError.directoryNotReadable(
				inputPath,
				this.#toError(error),
			);
		}
		if (!stats.isDirectory()) {
			throw FileSystemError.notDirectory(inputPath);
		}

		let files: Dirent[];
		try {
			files = readdirSync(inputPath, { withFileTypes: true });
		} catch (error: unknown) {
			throw FileSystemError.directoryNotReadable(
				inputPath,
				this.#toError(error),
			);
		}

		const sqlFiles = files.filter(
			(file) => file.isFile() && extname(file.name).toLowerCase() === '.sql',
		);
		if (sqlFiles.length === 0) {
			throw FileSystemError.noSqlFiles(inputPath);
		}
	};

	/**
	 * Validate that output directory exists (if output path is provided)
	 */
	validateOutputDirectory = (outputPath: string): void => {
		const outputDir = dirname(outputPath);
		if (!existsSync(outputDir)) {
			throw FileSystemError.invalidOutputPath(outputPath);
		}
		try {
			if (!statSync(outputDir).isDirectory()) {
				throw FileSystemError.invalidOutputPath(outputPath);
			}
		} catch (error: unknown) {
			if (error instanceof FileSystemError) throw error;
			throw FileSystemError.invalidOutputPath(outputPath, this.#toError(error));
		}
	};

	/**
	 * Validate SQL dialect
	 */
	validateDialect = (dialect: string): void => {
		if (!isSupportedDialect(dialect)) {
			throw ConfigurationError.invalidOptions('dialect', dialect);
		}
	};

	#toError(error: unknown): Error {
		return error instanceof Error ? error : new Error(String(error));
	}
}

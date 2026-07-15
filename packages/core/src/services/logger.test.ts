import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, type LogLevel } from './logger.js';

/**
 * Logger contract: every message is written to the STDERR stream, stdout is
 * never touched. Stdout belongs to program output (merged SQL), so that
 * `sqlsmith <dir> > out.sql` produces a clean SQL file.
 */
describe('Logger', () => {
	let stderrSpy: ReturnType<typeof vi.spyOn>;
	let stdoutSpy: ReturnType<typeof vi.spyOn>;

	const stderrText = (): string =>
		stderrSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('');

	beforeEach(() => {
		stderrSpy = vi
			.spyOn(process.stderr, 'write')
			.mockImplementation(() => true);
		stdoutSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('output channel', () => {
		it('never writes to stdout, whatever the method or level', () => {
			const logger = new Logger({ logLevel: 'debug' });

			logger.error('e');
			logger.warn('w');
			logger.info('i');
			logger.debug('d');
			logger.success('s');
			logger.header('h');
			logger.raw('r');

			expect(stdoutSpy).not.toHaveBeenCalled();
		});

		it('writes every enabled message to stderr', () => {
			const logger = new Logger({ logLevel: 'debug' });

			logger.error('an error');
			logger.warn('a warning');
			logger.info('an info');
			logger.debug('a debug');
			logger.success('a success');
			logger.header('a header');
			logger.raw('a raw');

			const output = stderrText();
			for (const message of [
				'an error',
				'a warning',
				'an info',
				'a debug',
				'a success',
				'a header',
				'a raw',
			]) {
				expect(output).toContain(message);
			}
		});

		it('terminates each message with a newline', () => {
			const logger = new Logger({ logLevel: 'info' });

			logger.info('first');
			logger.error('second');

			for (const call of stderrSpy.mock.calls) {
				expect(String(call[0])).toMatch(/\n$/);
			}
		});
	});

	describe('log level hierarchy', () => {
		const testCases: Array<{
			logLevel: LogLevel;
			enabled: string[];
			disabled: string[];
		}> = [
			{
				logLevel: 'error',
				enabled: ['error'],
				disabled: ['warn', 'info', 'debug', 'success', 'header', 'raw'],
			},
			{
				logLevel: 'warn',
				enabled: ['error', 'warn'],
				disabled: ['info', 'debug', 'success', 'header', 'raw'],
			},
			{
				logLevel: 'info',
				enabled: ['error', 'warn', 'info', 'success', 'header', 'raw'],
				disabled: ['debug'],
			},
			{
				logLevel: 'debug',
				enabled: ['error', 'warn', 'info', 'debug', 'success', 'header', 'raw'],
				disabled: [],
			},
		];

		const invoke = (logger: Logger, method: string, message: string): void => {
			const methods: Record<string, (message: string) => void> = {
				error: logger.error,
				warn: logger.warn,
				info: logger.info,
				debug: logger.debug,
				success: logger.success,
				header: (title) => logger.header(title),
				raw: logger.raw,
			};
			const fn = methods[method];
			if (!fn) {
				throw new Error(`Unknown method: ${method}`);
			}
			fn(message);
		};

		testCases.forEach(({ logLevel, enabled, disabled }) => {
			describe(`logLevel: ${logLevel}`, () => {
				enabled.forEach((method) => {
					it(`logs ${method} messages`, () => {
						const logger = new Logger({ logLevel });
						invoke(logger, method, `${method} probe`);
						expect(stderrText()).toContain(`${method} probe`);
					});
				});

				disabled.forEach((method) => {
					it(`does NOT log ${method} messages`, () => {
						const logger = new Logger({ logLevel });
						invoke(logger, method, `${method} probe`);
						expect(stderrText()).not.toContain(`${method} probe`);
					});
				});
			});
		});

		it('defaults to info level', () => {
			const logger = new Logger();
			logger.debug('hidden');
			logger.info('visible');

			expect(stderrText()).toContain('visible');
			expect(stderrText()).not.toContain('hidden');
		});
	});

	describe('formatting', () => {
		let logger: Logger;

		beforeEach(() => {
			logger = new Logger({ logLevel: 'debug' });
		});

		it('prefixes error messages with ❌', () => {
			logger.error('boom');
			expect(stderrText()).toContain('❌ boom');
		});

		it('prefixes warn messages with ⚠️', () => {
			logger.warn('careful');
			expect(stderrText()).toContain('⚠️  careful');
		});

		it('prefixes debug messages with 🐛', () => {
			logger.debug('details');
			expect(stderrText()).toContain('🐛 details');
		});

		it('prefixes success messages with ✅', () => {
			logger.success('done');
			expect(stderrText()).toContain('✅ done');
		});

		it('does not prefix info and raw messages', () => {
			logger.info('plain info');
			logger.raw('plain raw');

			expect(stderrText()).toContain('plain info');
			expect(stderrText()).toContain('plain raw');
			for (const prefix of ['❌', '⚠️', '🐛', '✅']) {
				expect(stderrText()).not.toContain(`${prefix} plain`);
			}
		});

		it('renders a header with a separator of at least 50 characters', () => {
			logger.header('Test Header');
			expect(stderrText()).toContain('Test Header');
			expect(stderrText()).toContain('='.repeat(50));
		});

		it('adapts the separator length to titles longer than 50 characters', () => {
			const longTitle =
				'This is a very long title that exceeds fifty characters for testing';
			logger.header(longTitle);
			expect(stderrText()).toContain('='.repeat(longTitle.length));
		});

		it('supports a custom header separator', () => {
			logger.header('Short', '-');
			expect(stderrText()).toContain('-'.repeat(50));
		});

		it('formats additional arguments into the message', () => {
			logger.info('with args', 42, 'extra');
			logger.error('with object', { object: true });

			expect(stderrText()).toContain('with args 42 extra');
			expect(stderrText()).toContain('{ object: true }');
		});

		it('handles undefined and null arguments without throwing', () => {
			expect(() => {
				logger.info('test', undefined, null);
				logger.error('test', undefined, null);
			}).not.toThrow();
		});
	});
});

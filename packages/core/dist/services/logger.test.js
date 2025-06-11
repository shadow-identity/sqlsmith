import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from './logger.js';
describe('Logger', () => {
    let consoleMocks;
    beforeEach(() => {
        // Mock all console methods
        consoleMocks = {
            error: vi.spyOn(console, 'error').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            info: vi.spyOn(console, 'info').mockImplementation(() => { }),
            debug: vi.spyOn(console, 'debug').mockImplementation(() => { }),
        };
    });
    afterEach(() => {
        // Restore all mocks
        vi.restoreAllMocks();
    });
    describe('Constructor', () => {
        it('should create logger with default options', () => {
            const logger = new Logger();
            expect(logger).toBeInstanceOf(Logger);
        });
        it('should create logger with custom log level', () => {
            const logger = new Logger({ logLevel: 'debug' });
            expect(logger).toBeInstanceOf(Logger);
        });
        it('should create logger with empty options', () => {
            const logger = new Logger({});
            expect(logger).toBeInstanceOf(Logger);
        });
    });
    describe('Log level hierarchy', () => {
        const testCases = [
            {
                logLevel: 'error',
                shouldLog: {
                    error: true,
                    warn: false,
                    info: false,
                    debug: false,
                    success: false,
                    header: false,
                    raw: false,
                },
            },
            {
                logLevel: 'warn',
                shouldLog: {
                    error: true,
                    warn: true,
                    info: false,
                    debug: false,
                    success: false,
                    header: false,
                    raw: false,
                },
            },
            {
                logLevel: 'info',
                shouldLog: {
                    error: true,
                    warn: true,
                    info: true,
                    debug: false,
                    success: true,
                    header: true,
                    raw: true,
                },
            },
            {
                logLevel: 'debug',
                shouldLog: {
                    error: true,
                    warn: true,
                    info: true,
                    debug: true,
                    success: true,
                    header: true,
                    raw: true,
                },
            },
        ];
        testCases.forEach(({ logLevel, shouldLog }) => {
            describe(`logLevel: ${logLevel}`, () => {
                let logger;
                beforeEach(() => {
                    logger = new Logger({ logLevel });
                });
                it(`should ${shouldLog.error ? '' : 'NOT '}log error messages`, () => {
                    logger.error('test error');
                    if (shouldLog.error) {
                        expect(consoleMocks.error).toHaveBeenCalledWith('❌ test error');
                    }
                    else {
                        expect(consoleMocks.error).not.toHaveBeenCalled();
                    }
                });
                it(`should ${shouldLog.warn ? '' : 'NOT '}log warn messages`, () => {
                    logger.warn('test warning');
                    if (shouldLog.warn) {
                        expect(consoleMocks.warn).toHaveBeenCalledWith('⚠️  test warning');
                    }
                    else {
                        expect(consoleMocks.warn).not.toHaveBeenCalled();
                    }
                });
                it(`should ${shouldLog.info ? '' : 'NOT '}log info messages`, () => {
                    logger.info('test info');
                    if (shouldLog.info) {
                        expect(consoleMocks.info).toHaveBeenCalledWith('test info');
                    }
                    else {
                        expect(consoleMocks.info).not.toHaveBeenCalled();
                    }
                });
                it(`should ${shouldLog.debug ? '' : 'NOT '}log debug messages`, () => {
                    logger.debug('test debug');
                    if (shouldLog.debug) {
                        expect(consoleMocks.debug).toHaveBeenCalledWith('🐛 test debug');
                    }
                    else {
                        expect(consoleMocks.debug).not.toHaveBeenCalled();
                    }
                });
                it(`should ${shouldLog.success ? '' : 'NOT '}log success messages`, () => {
                    logger.success('test success');
                    if (shouldLog.success) {
                        expect(consoleMocks.info).toHaveBeenCalledWith('✅ test success');
                    }
                    else {
                        expect(consoleMocks.info).not.toHaveBeenCalled();
                    }
                });
                it(`should ${shouldLog.header ? '' : 'NOT '}log header messages`, () => {
                    logger.header('Test Header');
                    if (shouldLog.header) {
                        expect(consoleMocks.info).toHaveBeenCalledTimes(2);
                        expect(consoleMocks.info).toHaveBeenNthCalledWith(1, '\nTest Header');
                        expect(consoleMocks.info).toHaveBeenNthCalledWith(2, '='.repeat(50));
                    }
                    else {
                        expect(consoleMocks.info).not.toHaveBeenCalled();
                    }
                });
                it(`should ${shouldLog.raw ? '' : 'NOT '}log raw messages`, () => {
                    logger.raw('test raw');
                    if (shouldLog.raw) {
                        expect(consoleMocks.info).toHaveBeenCalledWith('test raw');
                    }
                    else {
                        expect(consoleMocks.info).not.toHaveBeenCalled();
                    }
                });
            });
        });
    });
    describe('Logging methods with arguments', () => {
        let logger;
        beforeEach(() => {
            logger = new Logger({ logLevel: 'debug' }); // Enable all logging
        });
        it('should pass multiple arguments to console.error', () => {
            logger.error('test error', 'extra', 'args', { object: true });
            expect(consoleMocks.error).toHaveBeenCalledWith('❌ test error', 'extra', 'args', { object: true });
        });
        it('should pass multiple arguments to console.warn', () => {
            logger.warn('test warning', 123, null);
            expect(consoleMocks.warn).toHaveBeenCalledWith('⚠️  test warning', 123, null);
        });
        it('should pass multiple arguments to console.info', () => {
            logger.info('test info', [1, 2, 3]);
            expect(consoleMocks.info).toHaveBeenCalledWith('test info', [1, 2, 3]);
        });
        it('should pass multiple arguments to console.debug', () => {
            logger.debug('test debug', { nested: { data: 'value' } });
            expect(consoleMocks.debug).toHaveBeenCalledWith('🐛 test debug', { nested: { data: 'value' } });
        });
        it('should pass multiple arguments to success method', () => {
            logger.success('test success', 'more', 'data');
            expect(consoleMocks.info).toHaveBeenCalledWith('✅ test success', 'more', 'data');
        });
        it('should pass multiple arguments to raw method', () => {
            logger.raw('raw message', 'arg1', 'arg2');
            expect(consoleMocks.info).toHaveBeenCalledWith('raw message', 'arg1', 'arg2');
        });
    });
    describe('Header method variations', () => {
        let logger;
        beforeEach(() => {
            logger = new Logger({ logLevel: 'info' });
        });
        it('should use default separator for header', () => {
            logger.header('Test Header');
            expect(consoleMocks.info).toHaveBeenCalledTimes(2);
            expect(consoleMocks.info).toHaveBeenNthCalledWith(1, '\nTest Header');
            expect(consoleMocks.info).toHaveBeenNthCalledWith(2, '='.repeat(50));
        });
        it('should use custom separator for header', () => {
            logger.header('Short', '-');
            expect(consoleMocks.info).toHaveBeenCalledTimes(2);
            expect(consoleMocks.info).toHaveBeenNthCalledWith(1, '\nShort');
            expect(consoleMocks.info).toHaveBeenNthCalledWith(2, '-'.repeat(50));
        });
        it('should adapt separator length to title length when title is longer than 50 chars', () => {
            const longTitle = 'This is a very long title that exceeds 50 characters for testing purposes';
            logger.header(longTitle);
            expect(consoleMocks.info).toHaveBeenCalledTimes(2);
            expect(consoleMocks.info).toHaveBeenNthCalledWith(1, `\n${longTitle}`);
            expect(consoleMocks.info).toHaveBeenNthCalledWith(2, '='.repeat(longTitle.length));
        });
        it('should use minimum 50 character separator for short titles', () => {
            logger.header('Hi', '*');
            expect(consoleMocks.info).toHaveBeenCalledTimes(2);
            expect(consoleMocks.info).toHaveBeenNthCalledWith(1, '\nHi');
            expect(consoleMocks.info).toHaveBeenNthCalledWith(2, '*'.repeat(50));
        });
    });
    describe('Console method mapping', () => {
        let logger;
        beforeEach(() => {
            logger = new Logger({ logLevel: 'debug' });
        });
        it('should use console.error for error method', () => {
            logger.error('error test');
            expect(consoleMocks.error).toHaveBeenCalled();
            expect(consoleMocks.warn).not.toHaveBeenCalled();
            expect(consoleMocks.info).not.toHaveBeenCalled();
            expect(consoleMocks.debug).not.toHaveBeenCalled();
        });
        it('should use console.warn for warn method', () => {
            logger.warn('warn test');
            expect(consoleMocks.warn).toHaveBeenCalled();
            expect(consoleMocks.error).not.toHaveBeenCalled();
            expect(consoleMocks.info).not.toHaveBeenCalled();
            expect(consoleMocks.debug).not.toHaveBeenCalled();
        });
        it('should use console.info for info method', () => {
            logger.info('info test');
            expect(consoleMocks.info).toHaveBeenCalled();
            expect(consoleMocks.error).not.toHaveBeenCalled();
            expect(consoleMocks.warn).not.toHaveBeenCalled();
            expect(consoleMocks.debug).not.toHaveBeenCalled();
        });
        it('should use console.debug for debug method', () => {
            logger.debug('debug test');
            expect(consoleMocks.debug).toHaveBeenCalled();
            expect(consoleMocks.error).not.toHaveBeenCalled();
            expect(consoleMocks.warn).not.toHaveBeenCalled();
            expect(consoleMocks.info).not.toHaveBeenCalled();
        });
        it('should use console.info for success method', () => {
            logger.success('success test');
            expect(consoleMocks.info).toHaveBeenCalled();
            expect(consoleMocks.error).not.toHaveBeenCalled();
            expect(consoleMocks.warn).not.toHaveBeenCalled();
            expect(consoleMocks.debug).not.toHaveBeenCalled();
        });
        it('should use console.info for header method', () => {
            logger.header('header test');
            expect(consoleMocks.info).toHaveBeenCalled();
            expect(consoleMocks.error).not.toHaveBeenCalled();
            expect(consoleMocks.warn).not.toHaveBeenCalled();
            expect(consoleMocks.debug).not.toHaveBeenCalled();
        });
        it('should use console.info for raw method', () => {
            logger.raw('raw test');
            expect(consoleMocks.info).toHaveBeenCalled();
            expect(consoleMocks.error).not.toHaveBeenCalled();
            expect(consoleMocks.warn).not.toHaveBeenCalled();
            expect(consoleMocks.debug).not.toHaveBeenCalled();
        });
    });
    describe('Edge cases', () => {
        let logger;
        beforeEach(() => {
            logger = new Logger({ logLevel: 'debug' });
        });
        it('should handle empty string messages', () => {
            logger.error('');
            logger.warn('');
            logger.info('');
            logger.debug('');
            expect(consoleMocks.error).toHaveBeenCalledWith('❌ ');
            expect(consoleMocks.warn).toHaveBeenCalledWith('⚠️  ');
            expect(consoleMocks.info).toHaveBeenCalledWith('');
            expect(consoleMocks.debug).toHaveBeenCalledWith('🐛 ');
        });
        it('should handle undefined and null arguments', () => {
            expect(() => {
                logger.error('test', undefined, null);
                logger.warn('test', undefined);
                logger.info('test', null);
                logger.debug('test', undefined, null);
            }).not.toThrow();
            expect(consoleMocks.error).toHaveBeenCalledWith('❌ test', undefined, null);
            expect(consoleMocks.warn).toHaveBeenCalledWith('⚠️  test', undefined);
            expect(consoleMocks.info).toHaveBeenCalledWith('test', null);
            expect(consoleMocks.debug).toHaveBeenCalledWith('🐛 test', undefined, null);
        });
        it('should handle complex objects', () => {
            const complexObject = {
                array: [1, 2, 3],
                nested: { deep: 'value' },
                func: () => 'test',
                date: new Date('2023-01-01'),
            };
            logger.info('Complex:', complexObject);
            expect(consoleMocks.info).toHaveBeenCalledWith('Complex:', complexObject);
        });
        it('should handle no arguments after message', () => {
            logger.error('solo error');
            logger.warn('solo warn');
            logger.info('solo info');
            logger.debug('solo debug');
            expect(consoleMocks.error).toHaveBeenCalledWith('❌ solo error');
            expect(consoleMocks.warn).toHaveBeenCalledWith('⚠️  solo warn');
            expect(consoleMocks.info).toHaveBeenCalledWith('solo info');
            expect(consoleMocks.debug).toHaveBeenCalledWith('🐛 solo debug');
        });
        it('should handle empty header title', () => {
            logger.header('');
            expect(consoleMocks.info).toHaveBeenCalledTimes(2);
            expect(consoleMocks.info).toHaveBeenNthCalledWith(1, '\n');
            expect(consoleMocks.info).toHaveBeenNthCalledWith(2, '='.repeat(50));
        });
    });
});
//# sourceMappingURL=logger.test.js.map
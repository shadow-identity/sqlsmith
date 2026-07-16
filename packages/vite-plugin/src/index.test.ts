import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ParsingError } from '@sqlsmith/core';
import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqlsmith } from './index.js';

// C5-NESTED / C5-SILENT / C5-CONTAINMENT / C5-WATCH / C5-ATOMIC
// R5-02 / R5-03 / R5-04 / R5-05 / R5-06

type WatchEvent = 'create' | 'update' | 'delete';

const callHook = async (
	plugin: Plugin,
	name: 'configResolved' | 'buildStart' | 'watchChange',
	context: PluginContext,
	...args: unknown[]
): Promise<unknown> => {
	const hook = plugin[name] as
		| ((...hookArgs: unknown[]) => unknown)
		| { handler: (...hookArgs: unknown[]) => unknown }
		| undefined;
	if (!hook) throw new Error(`Missing plugin hook: ${name}`);
	const handler = typeof hook === 'function' ? hook : hook.handler;
	return await handler.call(context, ...args);
};

const configure = async (
	plugin: Plugin,
	context: PluginContext,
	command: 'build' | 'serve',
): Promise<void> => {
	await callHook(plugin, 'configResolved', context, { command });
};

describe('sqlsmith Vite hooks', () => {
	let scratch: string;
	let input: string;
	let sibling: string;
	let output: string;
	let parentFile: string;
	let childFile: string;
	let siblingFile: string;
	let context: PluginContext;
	let addWatchFile: ReturnType<typeof vi.fn>;
	let reportError: ReturnType<typeof vi.fn>;
	let stderr: ReturnType<typeof vi.spyOn>;

	const stderrText = (): string =>
		stderr.mock.calls.map((call) => String(call[0])).join('');

	const createPlugin = (
		logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug' = 'info',
	): Plugin =>
		sqlsmith({
			input,
			output,
			dialect: 'postgresql',
			watch: true,
			logLevel,
		});

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
		scratch = mkdtempSync(join(tmpdir(), 'sqlsmith-vite-'));
		input = join(scratch, 'input');
		sibling = join(scratch, 'input-other');
		output = join(input, 'generated', 'schema.sql');
		parentFile = join(input, 'users.sql');
		childFile = join(input, 'nested', 'posts.sql');
		siblingFile = join(sibling, 'ignored.sql');
		mkdirSync(join(input, 'nested'), { recursive: true });
		mkdirSync(join(input, 'generated'), { recursive: true });
		mkdirSync(sibling, { recursive: true });
		writeFileSync(parentFile, 'CREATE TABLE users (id integer PRIMARY KEY);\n');
		writeFileSync(
			childFile,
			'CREATE TABLE posts (id integer PRIMARY KEY, user_id integer REFERENCES users(id));\n',
		);
		writeFileSync(siblingFile, 'CREATE TABLE ignored (id integer);\n');

		addWatchFile = vi.fn();
		reportError = vi.fn();
		context = {
			addWatchFile,
			error: reportError,
		} as unknown as PluginContext;
		stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		rmSync(scratch, { recursive: true, force: true });
	});

	it('silent build generates nested SQL and registers only shared-discovery inputs', async () => {
		const plugin = createPlugin('silent');
		await configure(plugin, context, 'build');

		await callHook(plugin, 'buildStart', context);

		const sql = readFileSync(output, 'utf8');
		expect(sql.indexOf('CREATE TABLE users')).toBeLessThan(
			sql.indexOf('CREATE TABLE posts'),
		);
		expect(stderrText()).toBe('');
		const watched = addWatchFile.mock.calls.map(([path]) =>
			resolve(String(path)),
		);
		expect(watched).toEqual(
			expect.arrayContaining([
				resolve(input),
				resolve(parentFile),
				resolve(childFile),
			]),
		);
		expect(watched).not.toContain(resolve(siblingFile));
		expect(watched).not.toContain(resolve(output));
	});

	it('ignores sibling and generated-output events without prefix confusion', async () => {
		const plugin = createPlugin();
		await configure(plugin, context, 'serve');
		await callHook(plugin, 'buildStart', context);
		writeFileSync(
			parentFile,
			'CREATE TABLE users (id integer PRIMARY KEY, email text);\n',
		);
		stderr.mockClear();

		await callHook(plugin, 'watchChange', context, siblingFile, {
			event: 'update',
		});
		await callHook(plugin, 'watchChange', context, output, { event: 'update' });

		expect(readFileSync(output, 'utf8')).not.toContain('email text');
		expect(stderrText()).not.toContain('Schema updated');
	});

	it.each<WatchEvent>(['create', 'update', 'delete'])(
		'rediscovers and generates exactly once for a nested %s',
		async (event) => {
			const plugin = createPlugin();
			await configure(plugin, context, 'serve');
			await callHook(plugin, 'buildStart', context);
			stderr.mockClear();

			let changedFile = childFile;
			if (event === 'create') {
				changedFile = join(input, 'nested', 'comments.sql');
				writeFileSync(
					changedFile,
					'CREATE TABLE comments (id integer PRIMARY KEY);\n',
				);
			} else if (event === 'update') {
				writeFileSync(
					childFile,
					'CREATE TABLE posts (id integer PRIMARY KEY, user_id integer REFERENCES users(id), title text);\n',
				);
			} else {
				rmSync(childFile);
			}

			await callHook(plugin, 'watchChange', context, changedFile, { event });

			const sql = readFileSync(output, 'utf8');
			if (event === 'create') expect(sql).toContain('CREATE TABLE comments');
			if (event === 'update') expect(sql).toContain('title text');
			if (event === 'delete') expect(sql).not.toContain('CREATE TABLE posts');
			expect(stderrText().split('Schema updated').length - 1).toBe(1);
		},
	);

	it('preserves last-good output and reports one dev error, even when silent', async () => {
		const plugin = createPlugin('silent');
		await configure(plugin, context, 'serve');
		await callHook(plugin, 'buildStart', context);
		const lastGood = readFileSync(output, 'utf8');
		writeFileSync(childFile, 'CREATE TABLE broken (;\n');
		stderr.mockClear();

		await callHook(plugin, 'watchChange', context, childFile, {
			event: 'update',
		});

		expect(readFileSync(output, 'utf8')).toBe(lastGood);
		expect(reportError).toHaveBeenCalledTimes(1);
		expect(reportError.mock.calls[0][0]).toBeInstanceOf(ParsingError);
		expect(stderrText()).toBe('');
		expect(
			readdirSync(join(input, 'generated')).filter((name) =>
				name.includes('.tmp'),
			),
		).toEqual([]);
	});

	it('rethrows a typed failure in build mode without creating output', async () => {
		writeFileSync(childFile, 'CREATE TABLE broken (;\n');
		const plugin = createPlugin('silent');
		await configure(plugin, context, 'build');

		await expect(
			callHook(plugin, 'buildStart', context),
		).rejects.toBeInstanceOf(ParsingError);
		expect(existsSync(output)).toBe(false);
		expect(reportError).not.toHaveBeenCalled();
	});

	it('shares log levels with core and renders each diagnostic once', async () => {
		writeFileSync(
			parentFile,
			`${readFileSync(parentFile, 'utf8')}CREATE INDEX idx_users_id ON users(id);\n`,
		);
		const silentOutput = join(scratch, 'silent.sql');
		const silentPlugin = sqlsmith({
			input,
			output: silentOutput,
			logLevel: 'silent',
		});
		await configure(silentPlugin, context, 'build');
		await callHook(silentPlugin, 'buildStart', context);
		const silentSql = readFileSync(silentOutput, 'utf8');
		expect(stderrText()).toBe('');

		stderr.mockClear();
		const debugOutput = join(scratch, 'debug.sql');
		const debugPlugin = sqlsmith({
			input,
			output: debugOutput,
			logLevel: 'debug',
		});
		await configure(debugPlugin, context, 'build');
		await callHook(debugPlugin, 'buildStart', context);

		expect(readFileSync(debugOutput, 'utf8')).toBe(silentSql);
		expect(stderrText()).toContain('Planning SQL directory');
		expect(stderrText().split('unrecognized statement(s)').length - 1).toBe(1);
		expect(stderrText().split('Schema updated').length - 1).toBe(1);
	});
});

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { sqlsmith } from '../src/index.js';

// C5-COMPAT / R5-07

describe('Vite build compatibility', () => {
	let root = '';

	afterEach(() => {
		if (root) rmSync(root, { recursive: true, force: true });
	});

	it('runs a real Vite 6 build and produces the schema', async () => {
		root = realpathSync(mkdtempSync(join(tmpdir(), 'sqlsmith-vite-build-')));
		const input = join(root, 'schemas');
		const output = join(root, 'generated', 'schema.sql');
		mkdirSync(input, { recursive: true });
		mkdirSync(join(root, 'generated'), { recursive: true });
		writeFileSync(join(root, 'index.html'), '<main>sqlsmith smoke</main>');
		writeFileSync(
			join(input, 'users.sql'),
			'CREATE TABLE users (id integer PRIMARY KEY);\n',
		);

		await build({
			root,
			logLevel: 'silent',
			plugins: [sqlsmith({ input, output, logLevel: 'silent' })],
			build: { write: false },
		});

		expect(existsSync(output)).toBe(true);
		expect(readFileSync(output, 'utf8')).toContain('CREATE TABLE users');
	});
});

import * as assert from 'assert';
import * as fs from 'fs';
import { svelte, tryToLoadJson } from '../helpers.js';

describe('parse', () => {
	fs.readdirSync(`${__dirname}/samples`).forEach(dir => {
		if (dir[0] === '.') return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo$/.test(dir);

		if (solo && process.env.CI) {
			throw new Error(
				`Forgot to remove '.solo' from test parser/samples/${dir}`
			);
		}

		(solo ? it.only : it)(dir, () => {
			const options = tryToLoadJson(`${__dirname}/samples/${dir}/options.json`) || {};

			const input = fs.readFileSync(`${__dirname}/samples/${dir}/input.svelte`, 'utf-8').replace(/\s+$/, '');
			const expectedOutput = tryToLoadJson(`${__dirname}/samples/${dir}/output.json`);
			const expectedError = tryToLoadJson(`${__dirname}/samples/${dir}/error.json`);

			try {
				const { ast } = svelte.compile(input, Object.assign(options, {
					generate: false
				}));

				fs.writeFileSync(`${__dirname}/samples/${dir}/_actual.json`, JSON.stringify(ast, null, '\t'));

				assert.deepEqual(ast.html, expectedOutput.html);
				assert.deepEqual(ast.css, expectedOutput.css);
				assert.deepEqual(ast.instance, expectedOutput.instance);
				assert.deepEqual(ast.module, expectedOutput.module);
			} catch (err) {
				if (err.name !== 'ParseError') throw err;
				if (!expectedError) throw err;

				try {
					assert.equal(err.code, expectedError.code);
					assert.equal(err.message, expectedError.message);
					assert.deepEqual(err.start, expectedError.start);
					assert.equal(err.pos, expectedError.pos);
					assert.equal(err.toString().split('\n')[0], `${expectedError.message} (${expectedError.start.line}:${expectedError.start.column})`);
				} catch (err2) {
					const e = err2.code === 'MODULE_NOT_FOUND' ? err : err2;
					throw e;
				}
			}
		});
	});
});

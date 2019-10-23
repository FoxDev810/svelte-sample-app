import * as fs from 'fs';
import * as assert from 'assert';
import { loadConfig, svelte } from '../helpers.js';

describe('preprocess', () => {
	fs.readdirSync(`${__dirname}/samples`).forEach(dir => {
		if (dir[0] === '.') return;

		const config = loadConfig(`${__dirname}/samples/${dir}/_config.js`);

		if (config.solo && process.env.CI) {
			throw new Error('Forgot to remove `solo: true` from test');
		}

		(config.skip ? it.skip : config.solo ? it.only : it)(dir, async () => {
			const input = fs.readFileSync(`${__dirname}/samples/${dir}/input.svelte`, 'utf-8');
			const expected = fs.readFileSync(`${__dirname}/samples/${dir}/output.svelte`, 'utf-8');

			const result = await svelte.preprocess(input, config.preprocess);
			fs.writeFileSync(`${__dirname}/samples/${dir}/_actual.html`, result.code);

			assert.equal(result.code, expected);

			assert.deepEqual(result.dependencies, config.dependencies || []);
		});
	});
});

import assert from 'assert';
import * as fs from 'fs';
import {parse} from 'acorn';
import {addLineNumbers, env, normalizeHtml, svelte} from '../helpers.js';

function tryRequire(file) {
	try {
		const mod = require(file);
		return mod.default || mod;
	} catch (err) {
		if (err.code !== 'MODULE_NOT_FOUND') throw err;
		return null;
	}
}

function normalizeWarning(warning) {
	warning.frame = warning.frame.replace(/^\n/, '').
		replace(/^\t+/gm, '').
		replace(/\s+$/gm, '');
	delete warning.filename;
	delete warning.toString;
	return warning;
}

function checkCodeIsValid(code) {
	try {
		parse(code);
	} catch (err) {
		console.error(addLineNumbers(code));
		throw new Error(err.message);
	}
}

describe('preprocess', () => {
	fs.readdirSync('test/preprocess/samples').forEach(dir => {
		if (dir[0] === '.') return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo/.test(dir);
		const skip = /\.skip/.test(dir);

		if (solo && process.env.CI) {
			throw new Error('Forgot to remove `solo: true` from test');
		}

		(solo ? it.only : skip ? it.skip : it)(dir, () => {
			const config = tryRequire(`./samples/${dir}/_config.js`) || {};
			const input = fs.existsSync(`test/preprocess/samples/${dir}/input.pug`) ?
				fs.readFileSync(`test/preprocess/samples/${dir}/input.pug`,
					'utf-8').replace(/\s+$/, '') :
				fs.readFileSync(`test/preprocess/samples/${dir}/input.html`,
					'utf-8').replace(/\s+$/, '');

			svelte.preprocess(input, config).
				then(processed => processed.toString()).
				then(processed => {

					const expectedWarnings = (config.warnings || []).map(
						normalizeWarning);
					const domWarnings = [];
					const ssrWarnings = [];

					const dom = svelte.compile(
						processed,
						Object.assign(config, {
							format: 'iife',
							name: 'SvelteComponent',
							onwarn: warning => {
								domWarnings.push(warning);
							},
						})
					);

					const ssr = svelte.compile(
						processed,
						Object.assign(config, {
							format: 'iife',
							generate: 'ssr',
							name: 'SvelteComponent',
							onwarn: warning => {
								ssrWarnings.push(warning);
							},
						})
					);

					// check the code is valid
					checkCodeIsValid(dom.code);
					checkCodeIsValid(ssr.code);

					assert.equal(dom.css, ssr.css);

					assert.deepEqual(
						domWarnings.map(normalizeWarning),
						ssrWarnings.map(normalizeWarning)
					);
					assert.deepEqual(domWarnings.map(normalizeWarning), expectedWarnings);

					const expected = {
						html: read(`test/preprocess/samples/${dir}/expected.html`),
						css: read(`test/preprocess/samples/${dir}/expected.css`),
					};

					if (expected.css !== null) {
						fs.writeFileSync(`test/preprocess/samples/${dir}/_actual.css`,
							dom.css);
						assert.equal(dom.css.replace(/svelte-\d+/g, 'svelte-xyz'),
							expected.css);
					}

					// verify that the right elements have scoping selectors
					if (expected.html !== null) {
						const window = env();

						// dom
						try {
							const Component = eval(
								`(function () { ${dom.code}; return SvelteComponent; }())`
							);
							const target = window.document.querySelector('main');

							new Component({target, data: config.data});
							const html = target.innerHTML;

							fs.writeFileSync(`test/preprocess/samples/${dir}/_actual.html`,
								html);

							assert.equal(
								normalizeHtml(window,
									html.replace(/svelte-\d+/g, 'svelte-xyz')),
								normalizeHtml(window, expected.html)
							);
						} catch (err) {
							console.log(dom.code);
							throw err;
						}

						// ssr
						try {
							const component = eval(
								`(function () { ${ssr.code}; return SvelteComponent; }())`
							);

							assert.equal(
								normalizeHtml(
									window,
									component.render(config.data).
										replace(/svelte-\d+/g, 'svelte-xyz')
								),
								normalizeHtml(window, expected.html)
							);
						} catch (err) {
							console.log(ssr.code);
							throw err;
						}
					}
				}).catch(error => {
					throw error;
				});
		});
	});
});

function read(file) {
	try {
		return fs.readFileSync(file, 'utf-8');
	} catch (err) {
		return null;
	}
}

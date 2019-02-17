import * as fs from "fs";
import * as assert from "assert";
import { svelte, loadConfig, tryToLoadJson } from "../helpers.js";

describe("validate", () => {
	fs.readdirSync("test/validator/samples").forEach(dir => {
		if (dir[0] === ".") return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo/.test(dir);
		const skip = /\.skip/.test(dir);

		if (solo && process.env.CI) {
			throw new Error("Forgot to remove `solo: true` from test");
		}

		(solo ? it.only : skip ? it.skip : it)(dir, () => {
			const config = loadConfig(`./validator/samples/${dir}/_config.js`);

			const input = fs.readFileSync(`test/validator/samples/${dir}/input.svelte`, "utf-8").replace(/\s+$/, "");
			const expected_warnings = tryToLoadJson(`test/validator/samples/${dir}/warnings.json`) || [];
			const expected_errors = tryToLoadJson(`test/validator/samples/${dir}/errors.json`);

			let error;

			try {
				const { stats } = svelte.compile(input, {
					dev: config.dev,
					legacy: config.legacy,
					generate: false
				});

				const warnings = stats.warnings.map(w => ({
					code: w.code,
					message: w.message,
					pos: w.pos,
					start: w.start,
					end: w.end
				}));

				assert.deepEqual(warnings, expected_warnings);
			} catch (e) {
				error = e;
			}

			const expected = expected_errors && expected_errors[0];

			if (error || expected) {
				if (error && !expected) {
					throw error;
				}

				if (expected && !error) {
					throw new Error(`Expected an error: ${expected.message}`);
				}

				try {
					assert.equal(error.code, expected.code);
					assert.equal(error.message, expected.message);
					assert.deepEqual(error.start, expected.start);
					assert.deepEqual(error.end, expected.end);
					assert.equal(error.pos, expected.pos);
				} catch (e) {
					console.error(error)
					throw e;
				}
			}
		});
	});

	it("errors if options.name is illegal", () => {
		assert.throws(() => {
			svelte.compile("<div></div>", {
				name: "not.valid",
				generate: false
			});
		}, /options\.name must be a valid identifier/);
	});

	it("warns if options.name is not capitalised", () => {
		const { stats } = svelte.compile("<div></div>", {
			name: "lowercase",
			generate: false
		});

		assert.deepEqual(stats.warnings.map(w => ({
			code: w.code,
			message: w.message
		})), [{
			code: `options-lowercase-name`,
			message: "options.name should be capitalised"
		}]);
	});

	it("does not warn if options.name begins with non-alphabetic character", () => {
		const { stats } = svelte.compile("<div></div>", {
			name: "_",
			generate: false
		});

		assert.deepEqual(stats.warnings, []);
	});
});

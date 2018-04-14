import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { rollup } from "rollup";
import { loadConfig, svelte } from "../helpers.js";

describe("js", () => {
	fs.readdirSync("test/js/samples").forEach(dir => {
		if (dir[0] === ".") return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo/.test(dir);

		if (solo && process.env.CI) {
			throw new Error("Forgot to remove `solo: true` from test");
		}

		(solo ? it.only : it)(dir, () => {
			dir = path.resolve("test/js/samples", dir);
			const config = loadConfig(`${dir}/_config.js`);

			function test(input, v2) {
				let actual;

				try {
					const options = Object.assign(config.options || {}, {
						shared: true,
						parser: v2 ? 'v2' : 'v1'
					});

					actual = svelte.compile(input, options).code.replace(/generated by Svelte v\d+\.\d+\.\d+/, 'generated by Svelte vX.Y.Z');
				} catch (err) {
					console.log(err.frame);
					throw err;
				}

				const output = `${dir}/_actual${v2 ? '-v2' : ''}.js`;

				fs.writeFileSync(output, actual);

				return rollup({
					input: output,
					plugins: [
						{
							resolveId(importee, importer) {
								if (!importer) return importee;
								if (importee === "svelte/shared.js")
									return path.resolve("shared.js");
								return null;
							}
						}
					]
				}).then(bundle => {
					return bundle.generate({ format: "es" });
				}).then(({ code }) => {
					fs.writeFileSync(`${dir}/_actual-bundle${v2 ? '-v2' : ''}.js`, code);

					const expected = fs.readFileSync(`${dir}/expected${v2 ? '-v2' : ''}.js`, "utf-8");
					const expectedBundle = fs.readFileSync(
						`${dir}/expected-bundle${v2 ? '-v2' : ''}.js`,
						"utf-8"
					);

					assert.equal(
						actual.trim().replace(/^[ \t]+$/gm, ""),
						expected.trim().replace(/^[ \t]+$/gm, "")
					);

					assert.equal(
						code.trim().replace(/^[ \t]+$/gm, ""),
						expectedBundle.trim().replace(/^[ \t]+$/gm, "")
					);
				}).catch(err => {
					if (err.loc) console.error(err.loc);
					throw err;
				});
			}

			return Promise.resolve()
				.then(() => {
					return test(
						fs.readFileSync(`${dir}/input.html`, "utf-8").replace(/\s+$/, "")
					);
				})
				.then(() => {
					if (fs.existsSync(`${dir}/input-v2.html`)) {
						return test(
							fs.readFileSync(`${dir}/input-v2.html`, "utf-8").replace(/\s+$/, ""),
							'v2'
						);
					}
				});
		});
	});
});

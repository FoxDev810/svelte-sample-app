import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { rollup } from "rollup";
import { svelte } from "../helpers.js";

describe.skip("js", () => {
	fs.readdirSync("test/js/samples").forEach(dir => {
		if (dir[0] === ".") return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo/.test(dir);

		if (solo && process.env.CI) {
			throw new Error("Forgot to remove `solo: true` from test");
		}

		(solo ? it.only : it)(dir, () => {
			dir = path.resolve("test/js/samples", dir);
			const input = fs
				.readFileSync(`${dir}/input.html`, "utf-8")
				.replace(/\s+$/, "");

			let actual;

			try {
				actual = svelte.compile(input, {
					shared: true
				}).code;
			} catch (err) {
				console.log(err.frame);
				throw err;
			}

			fs.writeFileSync(`${dir}/_actual.js`, actual);
			const expected = fs.readFileSync(`${dir}/expected.js`, "utf-8");
			const expectedBundle = fs.readFileSync(
				`${dir}/expected-bundle.js`,
				"utf-8"
			);

			return rollup({
				entry: `${dir}/_actual.js`,
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
				const actualBundle = bundle.generate({ format: "es" }).code;
				fs.writeFileSync(`${dir}/_actual-bundle.js`, actualBundle);

				assert.equal(
					actual.trim().replace(/^\s+$/gm, ""),
					expected.trim().replace(/^\s+$/gm, "")
				);

				assert.equal(
					actualBundle.trim().replace(/^\s+$/gm, ""),
					expectedBundle.trim().replace(/^\s+$/gm, "")
				);
			});
		});
	});
});

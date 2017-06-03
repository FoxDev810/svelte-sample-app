import * as path from 'path';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import buble from 'rollup-plugin-buble';

export default {
	entry: 'src/server-side-rendering/register.js',
	moduleName: 'svelte',
	targets: [{ dest: 'ssr/register.js', format: 'cjs' }],
	plugins: [
		nodeResolve({ jsnext: true, module: true }),
		commonjs(),
		buble({
			include: 'src/**',
			exclude: 'src/shared/**',
			target: {
				node: 4
			}
		})
	],
	external: [path.resolve('src/index.ts'), 'fs', 'path'],
	paths: {
		[path.resolve('src/index.ts')]: '../compiler/svelte.js'
	},
	sourceMap: true
};

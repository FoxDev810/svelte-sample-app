# Svelte

The magical disappearing UI framework.

* [Read the introductory blog post](https://svelte.technology/blog/frameworks-without-the-framework/)
* [Read the guide](https://svelte.technology/guide)
* [Try it out](https://svelte.technology/repl)
* [Chat on Gitter](https://gitter.im/sveltejs/svelte)

---

This is the Svelte compiler, which is primarily intended for authors of tooling that integrates Svelte with different build systems. If you just want to write Svelte components and use them in your app, you probably want one of those tools:

* [svelte-cli](https://github.com/sveltejs/svelte-cli) – Command line interface for compiling components
* [rollup-plugin-svelte](https://github.com/rollup/rollup-plugin-svelte) – Rollup plugin
* [sveltify](https://github.com/tehshrike/sveltify) - Browserify transform
* [gulp-svelte](https://github.com/shinnn/gulp-svelte) - gulp plugin
* [metalsmith-svelte](https://github.com/shinnn/metalsmith-svelte) - Metalsmith plugin
* [system-svelte](https://github.com/CanopyTax/system-svelte) – System.js loader
* [svelte-loader](https://github.com/sveltejs/svelte-loader) – Webpack loader
* [meteor-svelte](https://github.com/klaussner/meteor-svelte) – Meteor build plugin
* More to come!


## API

```js
import * as svelte from 'svelte';

const { code, map } = svelte.compile( source, {
	// the target module format – defaults to 'es' (ES2015 modules), can
	// also be 'amd', 'cjs', 'umd' or 'iife'
	format: 'umd',

	// the filename of the source file, used in e.g. generating sourcemaps
	filename: 'MyComponent.html',

	// the name of the constructor. Required for 'iife' and 'umd' output,
	// but otherwise mostly useful for debugging. Defaults to 'SvelteComponent'
	name: 'MyComponent',

	// for 'amd' and 'umd' output, you can optionally specify an AMD module ID
	amd: {
		id: 'my-component'
	},

	// custom error/warning handlers. By default, errors will throw, and
	// warnings will be printed to the console. Where applicable, the
	// error/warning object will have `pos`, `loc` and `frame` properties
	onerror: err => {
		console.error( err.message );
	},

	onwarn: warning => {
		console.warn( warning.message );
	}
});
```


## Example/starter repos

* [charpeni/svelte-example](https://github.com/charpeni/svelte-example) - Some Svelte examples with configured Rollup, Babel, ESLint, directives, Two-Way binding, and nested components
* [EmilTholin/svelte-test](https://github.com/EmilTholin/svelte-test)
* [lukechinworth/codenames](https://github.com/lukechinworth/codenames/tree/svelte) – example integration with Redux


## License

[MIT](LICENSE)

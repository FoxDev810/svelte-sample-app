module.exports = {
	root: true,
	rules: {
		indent: 'off',
		'no-unused-vars': 'off',
		semi: [2, 'always'],
		'keyword-spacing': [2, { before: true, after: true }],
		'space-before-blocks': [2, 'always'],
		'no-mixed-spaces-and-tabs': [2, 'smart-tabs'],
		'no-cond-assign': 0,
		'object-shorthand': [2, 'always'],
		'no-const-assign': 2,
		'no-class-assign': 2,
		'no-this-before-super': 2,
		'no-var': 2,
		'no-unreachable': 2,
		'valid-typeof': 2,
		'quote-props': [2, 'as-needed'],
		'one-var': [2, 'never'],
		'prefer-arrow-callback': 2,
		'prefer-const': [2, { destructuring: 'all' }],
		'arrow-spacing': 2,
		'no-inner-declarations': 0,
		'require-atomic-updates': 'off',
		'@typescript-eslint/indent': 'off',
		'@typescript-eslint/camelcase': 'off',
		'@typescript-eslint/no-use-before-define': 'off',
		'@typescript-eslint/array-type': ['error', 'array-simple'],
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/explicit-member-accessibility': 'off',
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_'
			}
		],
		'@typescript-eslint/no-object-literal-type-assertion': [
			'error',
			{
				allowAsParameter: true
			}
		],
		'@typescript-eslint/no-unused-vars': 'off'
	},
	globals: {
		globalThis: false
	},
	env: {
		es6: true,
		browser: true,
		node: true,
		mocha: true
	},
	extends: [
		'eslint:recommended',
		'plugin:import/errors',
		'plugin:import/warnings',
		'plugin:import/typescript',
		'plugin:@typescript-eslint/recommended'
	],
	parserOptions: {
		ecmaVersion: 9,
		sourceType: 'module'
	},
	plugins: ['svelte3'],
	settings: {
		'import/core-modules': [
			'svelte',
			'svelte/internal',
			'svelte/store',
			'svelte/easing',
			'estree'
		],
		'svelte3/compiler': require('./compiler')
	},
	overrides: [
		{
			files: ['*.js'],
			rules: {
				'@typescript-eslint/no-var-requires': 'off'
			}
		},
		{
			files: ['*.svelte'],
			processor: 'svelte3/svelte3',
			rules: {
				'@typescript-eslint/indent': 'off'
			}
		}
	]
};

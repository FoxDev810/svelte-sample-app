// Test support for the `foreign` namespace preserving attribute case.

export default {
	html: `
		<page horizontalAlignment="center">
			<button textWrap="true" text="button">
		</page>
	`,
	options: {
		hydrate: false // Hydration test will fail as case sensitivity is only handled for svg elements.
	},
	compileOptions: {
		namespace: 'foreign'
	},
	test({ assert, target }) {
		const attr = sel => target.querySelector(sel).attributes[0].name;
		assert.equal(attr('page'), 'horizontalAlignment');
		assert.equal(attr('button'), 'textWrap');
	}
};

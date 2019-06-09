export default {
	props: {
		name: 'world',
	},

	html: `
		<editor>world</editor>
		<p>hello world</p>
	`,

	ssrHtml: `
		<editor contenteditable="true">world</editor>
		<p>hello world</p>
	`,

	async test({ assert, component, target, window }) {
		const el = target.querySelector('editor');
		assert.equal(el.textContent, 'world');

		const event = new window.Event('input');

		el.textContent = 'everybody';
		await el.dispatchEvent(event);

		assert.htmlEqual(target.innerHTML, `
			<editor>everybody</editor>
			<p>hello everybody</p>
		`);

		component.name = 'goodbye';
		assert.equal(el.textContent, 'goodbye');
		assert.htmlEqual(target.innerHTML, `
			<editor>goodbye</editor>
			<p>hello goodbye</p>
		`);
	},
};

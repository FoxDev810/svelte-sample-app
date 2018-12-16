export default {
	props: {
		bar: 'lol',
		x: 2,
		compound: 'piece of',
		go: { deeper: 'core' }
	},
	html: `<div><p>foo: lol</p>\n<p>baz: 42 (number)</p>\n<p>qux: this is a piece of string</p>\n<p>quux: core</p></div>`,
	test({ assert, component, target }) {
		component.bar = 'wut';
		component.x = 3;
		component.compound = 'rather boring';
		component.go = { deeper: 'heart' };

		assert.equal( target.innerHTML, `<div><p>foo: wut</p>\n<p>baz: 43 (number)</p>\n<p>qux: this is a rather boring string</p>\n<p>quux: heart</p></div>` );
	}
};

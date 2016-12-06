const ns = '<noscript></noscript>';
export default {
	data: {
		raw: '<span><em>raw html!!!\\o/</span></em>'
	},
	html: `before${ns}<span><em>raw html!!!\\o/</span></em>${ns}after`,

	test ( assert, component, target ) {
		component.set({ raw: '' });
		assert.equal( target.innerHTML, `before${ns}${ns}after` );
		component.set({ raw: 'how about <strong>unclosed elements?' });
		assert.equal( target.innerHTML, `before${ns}how about <strong>unclosed elements?</strong>${ns}after` );
		component.teardown();
		assert.equal( target.innerHTML, '' );
	}
};

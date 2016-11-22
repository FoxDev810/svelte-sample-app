export default {
	html: '<!--#if visible-->',
	test ( assert, component, target, window ) {
		component.set({ visible: true });
		assert.equal( component.refs.input, window.document.activeElement );
	}
};

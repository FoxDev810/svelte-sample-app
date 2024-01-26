import { test } from '../../test';

export default test({
	html: '<div><p>i am a widget</p></div>',

	test({ assert, component }) {
		const { widget } = component;
		assert.ok(widget.isWidget);
	}
});

import { test } from '../../test';

export default test({
	html: '1-2',

	async test({ assert, component, target }) {
		await component.update();

		assert.htmlEqual(target.innerHTML, '3-4');
	}
});

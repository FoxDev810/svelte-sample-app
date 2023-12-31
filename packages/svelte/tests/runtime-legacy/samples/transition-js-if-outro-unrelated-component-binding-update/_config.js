import { test } from '../../test';

export default test({
	async test({ assert, target, window, raf }) {
		const button = target.querySelector('button');
		const event = new window.MouseEvent('click', { bubbles: true });
		await button?.dispatchEvent(event);
		raf.tick(500);
		assert.htmlEqual(target.innerHTML, '');
	}
});

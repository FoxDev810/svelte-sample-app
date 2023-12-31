import { ok, test } from '../../test';

export default test({
	html: `
	<button>+1</button>
	<p>count: 1</p>
	`,

	async test({ assert, component, target, window }) {
		const click = new window.MouseEvent('click', { bubbles: true });
		const button = target.querySelector('button');
		ok(button);

		assert.equal(component.x, 1);

		await button.dispatchEvent(click);

		assert.equal(component.x, 3);
		assert.htmlEqual(
			target.innerHTML,
			`
			<button>+1</button>
			<p>count: 3</p>
		`
		);

		await button.dispatchEvent(click);

		assert.equal(component.x, 5);
		assert.htmlEqual(
			target.innerHTML,
			`
			<button>+1</button>
			<p>count: 5</p>
		`
		);
	}
});

import { test } from '../../test';

export default test({
	get props() {
		return { visible: true };
	},

	test({ assert, component, target, raf }) {
		component.visible = false;
		const span = /** @type {HTMLSpanElement & { foo: number }} */ (target.querySelector('span'));

		raf.tick(50);
		assert.equal(span.foo, 0.5);

		component.visible = true;
		assert.equal(span.foo, 1);

		raf.tick(75);
		assert.equal(span.foo, 1);

		raf.tick(100);
		assert.htmlEqual(
			target.innerHTML,
			`
			<span>hello</span>
		`
		);
	}
});

import { test } from '../../test';

export default test({
	get props() {
		return { visible: false, threshold: 5 };
	},

	html: `
		<div>1</div>
		<div>2</div>
		<div>3</div>
		<div>4</div>
		<div>5</div>
	`,

	test({ assert, component, target, raf }) {
		raf.tick(100);

		component.threshold = 4;
		raf.tick(150);
		component.threshold = 5;
		raf.tick(200);

		component.threshold = 5.5;

		assert.htmlEqual(
			target.innerHTML,
			`
			<div>1</div>
			<div>2</div>
			<div>3</div>
			<div>4</div>
			<div>5</div>
		`
		);
	}
});

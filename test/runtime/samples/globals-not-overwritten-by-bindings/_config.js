export default {
	html: `
		<div class="todo done">
			<input type="checkbox">
			<input type="text">
		</div>

		<div class="todo done">
			<input type="checkbox">
			<input type="text">
		</div>

		<div class="todo ">
			<input type="checkbox">
			<input type="text">
		</div>
	`,

	data: {
		todos: {
			first: {
				description: 'Buy some milk',
				done: true,
			},
			second: {
				description: 'Do the laundry',
				done: true,
			},
			third: {
				description: "Find life's true purpose",
				done: false,
			},
		},
	},

	test(assert, component, target, window) {
		const input = document.querySelectorAll('input[type="checkbox"]')[2];
		const change = new window.Event('change');

		input.checked = true;
		input.dispatchEvent(change);

		assert.ok(component.get().todos.third.done);
		assert.htmlEqual(target.innerHTML, `
			<div class="todo done">
				<input type="checkbox">
				<input type="text">
			</div>

			<div class="todo done">
				<input type="checkbox">
				<input type="text">
			</div>

			<div class="todo done">
				<input type="checkbox">
				<input type="text">
			</div>
		`);
	},
};

export default {
	dev: true,

	html: `
		<select>
			<option value='A'>A</option>
			<option value='B'>B</option>
			<option value='C'>C</option>
		</select>
	`,

	test(assert, component, target, window) {
		const select = target.querySelector('select');
		const options = target.querySelectorAll('option');

		const change = new window.Event('change');

		options[1].selected = true;
		select.dispatchEvent(change);

		assert.equal(component.get().selected.letter, 'B');
		assert.htmlEqual(target.innerHTML, `
			<select>
				<option value='A'>A</option>
				<option value='B'>B</option>
				<option value='C'>C</option>
			</select>

			B
		`);
	}
};
export default {
	skip: true, // selectedOptions doesn't work in JSDOM???

	html: `
		<p>selected: one</p>

		<select>
			<option>one</option>
			<option>two</option>
			<option>three</option>
		</select>

		<p>selected: one</p>
	`,

	test ( assert, component, target, window ) {
		const select = target.querySelector( 'select' );
		const options = [ ...target.querySelectorAll( 'option' ) ];

		assert.deepEqual( options, select.options );
		assert.equal( component.get( 'selected' ), 'one' );

		const change = new window.Event( 'change' );

		options[1].selected = true;
		select.dispatchEvent( change );

		assert.equal( component.get( 'selected' ), 'two' );
		assert.htmlEqual( target.innerHTML, `
			<p>selected: two</p>

			<select>
				<option>one</option>
				<option>two</option>
				<option>three</option>
			</select>

			<p>selected: two</p>
		` );

		component.set({ selected: 'three' });
	}
};

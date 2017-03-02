export default {
	skip: true, // selectedOptions doesn't work in JSDOM???

	data: {
		selected: [ 'two', 'three' ]
	},

	html: `
		<select>
			<option>one</option>
			<option>two</option>
			<option>three</option>
		</select>

		<p>selected: two, three</p>
	`,

	test ( assert, component, target, window ) {
		const select = target.querySelector( 'select' );
		const options = [ ...target.querySelectorAll( 'option' ) ];

		const change = new window.Event( 'change' );

		options[1].selected = false;
		select.dispatchEvent( change );

		assert.deepEqual( component.get( 'selected' ), [ 'three' ] );
		assert.htmlEqual( target.innerHTML, `
			<select>
				<option>one</option>
				<option>two</option>
				<option>three</option>
			</select>

			<p>selected: three</p>
		` );

		options[0].selected = true;
		select.dispatchEvent( change );

		assert.deepEqual( component.get( 'selected' ), [ 'one', 'three' ] );
		assert.htmlEqual( target.innerHTML, `
			<select>
				<option>one</option>
				<option>two</option>
				<option>three</option>
			</select>

			<p>selected: one, three</p>
		` );

		component.set({ selected: [ 'one', 'two' ] });

		assert.ok( options[0].selected );
		assert.ok( options[1].selected );
		assert.ok( !options[2].selected );

		assert.htmlEqual( target.innerHTML, `
			<select>
				<option>one</option>
				<option>two</option>
				<option>three</option>
			</select>

			<p>selected: one, two</p>
		` );
	}
};

export default {
	data: {
		count: 42
	},

	html: `
		<input type='range'>
		<p>number 42</p>
	`,

	test ( assert, component, target, window ) {
		const input = target.querySelector( 'input' );
		assert.equal( input.value, '42' );

		const event = new window.Event( 'change' );

		input.value = '43';
		input.dispatchEvent( event );

		assert.equal( component.get( 'count' ), 43 );
		assert.htmlEqual( target.innerHTML, `
			<input type='range'>
			<p>number 43</p>
		` );

		component.set({ count: 44 });
		assert.equal( input.value, '44' );
		assert.htmlEqual( target.innerHTML, `
			<input type='range'>
			<p>number 44</p>
		` );
	}
};

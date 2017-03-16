export default {
	test ( assert, component ) {
		let count = 0;

		component.on( 'destroy', function () {
			assert.equal( this, component );
			count += 1;
		});

		component.destroy();
		assert.equal( count, 1 );
	}
};

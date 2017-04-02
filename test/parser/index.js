import assert from 'assert';
import * as fs from 'fs';
import { svelte } from '../helpers.js';

describe( 'parse', () => {
	fs.readdirSync( 'test/parser/samples' ).forEach( dir => {
		if ( dir[0] === '.' ) return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo$/.test( dir );

		if ( solo && process.env.CI ) {
			throw new Error( `Forgot to remove '.solo' from test parser/samples/${dir}` );
		}

		( solo ? it.only : it )( dir, () => {
			const input = fs.readFileSync( `test/parser/samples/${dir}/input.html`, 'utf-8' ).replace( /\s+$/, '' );

			try {
				const actual = svelte.parse( input );
				fs.writeFileSync( `test/parser/samples/${dir}/_actual.json`, JSON.stringify( actual, null, '\t' ) );
				const expected = require( `./samples/${dir}/output.json` );

				assert.deepEqual( actual.html, expected.html );
				assert.deepEqual( actual.css, expected.css );
				assert.deepEqual( actual.js, expected.js );
			} catch ( err ) {
				if ( err.name !== 'ParseError' ) throw err;

				try {
					const expected = require( `./samples/${dir}/error.json` );

					assert.equal( err.message, expected.message );
					assert.deepEqual( err.loc, expected.loc );
					assert.equal( err.pos, expected.pos );
				} catch ( err2 ) {
					throw err2.code === 'MODULE_NOT_FOUND' ? err : err2;
				}
			}
		});
	});

	it( 'handles errors with options.onerror', () => {
		let errored = false;

		svelte.compile( `<h1>unclosed`, {
			onerror ( err ) {
				errored = true;
				assert.equal( err.message, `<h1> was left open` );
			}
		});

		assert.ok( errored );
	});

	it( 'throws without options.onerror', () => {
		assert.throws( () => {
			svelte.compile( `<h1>unclosed` );
		}, /<h1> was left open/ );
	});
});

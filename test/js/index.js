import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { svelte } from '../helpers.js';

describe( 'js', () => {
	fs.readdirSync( 'test/js/samples' ).forEach( dir => {
		if ( dir[0] === '.' ) return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo/.test( dir );

		if ( solo && process.env.CI ) {
			throw new Error( 'Forgot to remove `solo: true` from test' );
		}

		( solo ? it.only : it )( dir, () => {
			dir = path.resolve( 'test/js/samples', dir );
			const input = fs.readFileSync( `${dir}/input.html`, 'utf-8' ).replace( /\s+$/, '' );

			const actual = svelte.compile( input ).code;
			fs.writeFileSync( `${dir}/_actual.js`, actual );
			const expected = fs.readFileSync( `${dir}/expected.js`, 'utf-8' );

			assert.equal( actual.trim(), expected.trim() );
		});
	});
});

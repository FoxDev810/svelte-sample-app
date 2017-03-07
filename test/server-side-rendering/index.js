import assert from 'assert';
import * as fs from 'fs';

import { addLineNumbers, exists, loadConfig, setupHtmlEqual, svelte, tryToLoadJson } from '../helpers.js';

function tryToReadFile ( file ) {
	try {
		return fs.readFileSync( file, 'utf-8' );
	} catch ( err ) {
		if ( err.code !== 'ENOENT' ) throw err;
		return null;
	}
}

describe( 'ssr', () => {
	before( () => {
		require( process.env.COVERAGE ?
			'../../src/server-side-rendering/register.js' :
			'../../ssr/register' );

		return setupHtmlEqual();
	});

	fs.readdirSync( 'test/server-side-rendering/samples' ).forEach( dir => {
		if ( dir[0] === '.' ) return;

		const solo = exists( `test/server-side-rendering/samples/${dir}/solo` );

		if ( solo && process.env.CI ) {
			throw new Error( 'Forgot to remove `solo: true` from test' );
		}

		( solo ? it.only : it )( dir, () => {
			const component = require( `./samples/${dir}/main.html` );

			const expectedHtml = tryToReadFile( `test/server-side-rendering/samples/${dir}/_expected.html` );
			const expectedCss = tryToReadFile( `test/server-side-rendering/samples/${dir}/_expected.css` ) || '';

			const data = tryToLoadJson( `test/server-side-rendering/samples/${dir}/data.json` );
			const html = component.render( data );
			const { css } = component.renderCss();

			fs.writeFileSync( `test/server-side-rendering/samples/${dir}/_actual.html`, html );
			if ( css ) fs.writeFileSync( `test/server-side-rendering/samples/${dir}/_actual.css`, css );

			assert.htmlEqual( html, expectedHtml );
			assert.equal( css.replace( /^\s+/gm, '' ), expectedCss.replace( /^\s+/gm, '' ) );
		});
	});

	// duplicate client-side tests, as far as possible
	fs.readdirSync( 'test/generator/samples' ).forEach( dir => {
		if ( dir[0] === '.' ) return;

		const config = loadConfig( `./generator/samples/${dir}/_config.js` );

		if ( config.solo && process.env.CI ) {
			throw new Error( 'Forgot to remove `solo: true` from test' );
		}

		if ( config['skip-ssr'] ) return;

		( config.skip ? it.skip : config.solo ? it.only : it )( dir, () => {
			let compiled;

			try {
				const source = fs.readFileSync( `test/generator/samples/${dir}/main.html`, 'utf-8' );
				compiled = svelte.compile( source, { generate: 'ssr' });
			} catch ( err ) {
				if ( config.compileError ) {
					config.compileError( err );
					return;
				} else {
					throw err;
				}
			}

			const component = require( `../generator/samples/${dir}/main.html` );
			let html;

			try {
				html = component.render( config.data );

				if ( config.html ) {
					assert.htmlEqual( html, config.html );
				}
			} catch ( err ) {
				console.log( addLineNumbers( compiled.code ) ); // eslint-disable-line no-console
				throw err;
			}
		});
	});
});

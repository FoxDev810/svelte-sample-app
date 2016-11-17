import { compile } from '../compiler/index.js';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import jsdom from 'jsdom';

const cache = {};

require.extensions[ '.svelte' ] = function ( module, filename ) {
	const code = cache[ filename ];
	if ( !code ) throw new Error( `not compiled: ${filename}` );

	return module._compile( code, filename );
};

describe( 'svelte', () => {
	function loadConfig ( dir ) {
		try {
			return require( `./samples/${dir}/_config.js` ).default;
		} catch ( err ) {
			if ( err.code === 'E_NOT_FOUND' ) {
				return {};
			}

			throw err;
		}
	}

	function env () {
		return new Promise( ( fulfil, reject ) => {
			jsdom.env( '<main></main>', ( err, window ) => {
				if ( err ) {
					reject( err );
				} else {
					global.document = window.document;
					fulfil( window );
				}
			});
		});
	}

	fs.readdirSync( 'test/samples' ).forEach( dir => {
		if ( dir[0] === '.' ) return;

		const config = loadConfig( dir );

		( config.solo ? it.only : it )( dir, () => {
			let compiled;

			try {
				const source = fs.readFileSync( `test/samples/${dir}/main.svelte`, 'utf-8' );
				compiled = compile( source );
			} catch ( err ) {
				if ( config.compileError ) {
					config.compileError( err );
					return;
				} else {
					throw err;
				}
			}

			const { code } = compiled;

			cache[ path.resolve( `test/samples/${dir}/main.svelte` ) ] = code;
			const factory = require( `./samples/${dir}/main.svelte` ).default;

			if ( config.show ) {
				console.log( code ); // eslint-disable-line no-console
			}

			return env()
				.then( window => {
					const target = window.document.querySelector( 'main' );

					const component = factory({
						target,
						data: config.data
					});

					if ( config.html ) {
						assert.equal( target.innerHTML, config.html );
					}

					if ( config.test ) {
						config.test( component, target );
					}
				})
				.catch( err => {
					if ( !config.show ) console.log( code ); // eslint-disable-line no-console
					throw err;
				});
		});
	});
});

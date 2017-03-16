import jsdom from 'jsdom';
import assert from 'assert';
import * as fs from 'fs';

import * as consoleGroup from 'console-group';
consoleGroup.install();

import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// for coverage purposes, we need to test source files,
// but for sanity purposes, we need to test dist files
export const svelte = process.env.COVERAGE ?
	require( '../src/index.js' ) :
	require( '../compiler/svelte.js' );

export function exists ( path ) {
	try {
		fs.statSync( path );
		return true;
	} catch ( err ) {
		return false;
	}
}

export function tryToLoadJson ( file ) {
	try {
		return JSON.parse( fs.readFileSync( file ) );
	} catch ( err ) {
		if ( err.code !== 'ENOENT' ) throw err;
		return null;
	}
}

export function tryToReadFile ( file ) {
	try {
		return fs.readFileSync( file, 'utf-8' );
	} catch ( err ) {
		if ( err.code !== 'ENOENT' ) throw err;
		return null;
	}
}

export function env () {
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

function cleanChildren ( node ) {
	let previous = null;

	[ ...node.childNodes ].forEach( child => {
		if ( child.nodeType === 8 ) {
			// comment
			node.removeChild( child );
			return;
		}

		if ( child.nodeType === 3 ) {
			if ( node.namespaceURI === 'http://www.w3.org/2000/svg' && node.tagName !== 'text' && node.tagName !== 'tspan' ) {
				node.removeChild( child );
			}

			child.data = child.data.replace( /\s{2,}/, '\n' );

			if ( child.data === '\n' ) {
				node.removeChild( child );
			}

			// text
			else if ( previous && previous.nodeType === 3 ) {
				previous.data += child.data;
				previous.data = previous.data.replace( /\s{2,}/, '\n' );

				node.removeChild( child );
			}
		}

		else {
			cleanChildren( child );
		}

		previous = child;
	});

	// collapse whitespace
	if ( node.firstChild && node.firstChild.nodeType === 3 ) {
		node.firstChild.data = node.firstChild.data.replace( /^\s+/, '' );
		if ( !node.firstChild.data ) node.removeChild( node.firstChild );
	}

	if ( node.lastChild && node.lastChild.nodeType === 3 ) {
		node.lastChild.data = node.lastChild.data.replace( /\s+$/, '' );
		if ( !node.lastChild.data ) node.removeChild( node.lastChild );
	}
}

export function setupHtmlEqual () {
	return env().then( window => {
		assert.htmlEqual = ( actual, expected, message ) => {
			window.document.body.innerHTML = actual.trim();
			cleanChildren( window.document.body, '' );
			actual = window.document.body.innerHTML;

			window.document.body.innerHTML = expected.trim();
			cleanChildren( window.document.body, '' );
			expected = window.document.body.innerHTML;

			assert.deepEqual( actual, expected, message );
		};
	});
}

export function loadConfig ( file ) {
	try {
		const resolved = require.resolve( file );
		delete require.cache[ resolved ];
		return require( resolved ).default;
	} catch ( err ) {
		if ( err.code === 'E_NOT_FOUND' ) {
			return {};
		}

		throw err;
	}
}

export function addLineNumbers ( code ) {
	return code.split( '\n' ).map( ( line, i ) => {
		i = String( i + 1 );
		while ( i.length < 3 ) i = ` ${i}`;

		return `${i}: ${line.replace( /^\t+/, match => match.split( '\t' ).join( '    ' ) )}`;
	}).join( '\n' );
}

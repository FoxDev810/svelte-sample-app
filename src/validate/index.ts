import validateJs from './js/index.ts';
import validateHtml from './html/index.ts';
import { getLocator } from 'locate-character';
import getCodeFrame from '../utils/getCodeFrame.ts';

export default function validate ( parsed, source, { onerror, onwarn, name, filename } ) {
	const locator = getLocator( source );

	const validator = {
		error: ( message, pos ) => {
			const { line, column } = locator( pos );

			const error = new Error( message );
			error.frame = getCodeFrame( source, line, column );
			error.loc = { line: line + 1, column };
			error.pos = pos;
			error.filename = filename;

			error.toString = () => `${error.message} (${error.loc.line}:${error.loc.column})\n${error.frame}`;

			throw error;
		},

		warn: ( message, pos ) => {
			const { line, column } = locator( pos );

			const frame = getCodeFrame( source, line, column );

			onwarn({
				message,
				frame,
				loc: { line: line + 1, column },
				pos,
				filename,
				toString: () => `${message} (${line + 1}:${column})\n${frame}`
			});
		},

		source,

		namespace: null,
		defaultExport: null,
		properties: {},
		components: new Map(),
		methods: new Map(),
		helpers: new Map(),
		transitions: new Map()
	};

	try {
		if ( name && !/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test( name ) ) {
			const error = new Error( `options.name must be a valid identifier` );
			throw error;
		}

		if ( name && !/^[A-Z]/.test( name ) ) {
			const message = `options.name should be capitalised`;
			onwarn({
				message,
				filename,
				toString: () => message
			});
		}

		if ( parsed.js ) {
			validateJs( validator, parsed.js );
		}

		if ( parsed.html ) {
			validateHtml( validator, parsed.html );
		}
	} catch ( err ) {
		if ( onerror ) {
			onerror( err );
		} else {
			throw err;
		}
	}
}

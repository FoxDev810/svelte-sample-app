import deindent from '../../utils/deindent.js';
import CodeBuilder from '../../utils/CodeBuilder.js';
import processCss from '../shared/css/process.js';
import visitors from './visitors/index.js';
import Generator from '../Generator.js';

export default function ssr ( parsed, source, options, names ) {
	const format = options.format || 'cjs';
	const name = options.name || 'SvelteComponent';

	const generator = new Generator( parsed, source, names, visitors );

	const { computations, templateProperties } = generator.parseJs();

	const builders = {
		main: new CodeBuilder(),
		render: new CodeBuilder(),
		renderCss: new CodeBuilder()
	};

	// create main render() function
	generator.push({
		contexts: {},
		indexes: {}
	});

	let renderCode = '';
	generator.on( 'append', str => {
		renderCode += str;
	});

	parsed.html.children.forEach( node => generator.visit( node ) );

	builders.render.addLine(
		templateProperties.data ? `root = Object.assign( template.data(), root || {} );` : `root = root || {};`
	);

	computations.forEach( ({ key, deps }) => {
		builders.render.addLine(
			`root.${key} = template.computed.${key}( ${deps.map( dep => `root.${dep}` ).join( ', ' )} );`
		);
	});

	builders.render.addBlock(
		`return \`${renderCode}\`;`
	);

	// create renderCss() function
	builders.renderCss.addBlock(
		`var components = [];`
	);

	if ( parsed.css ) {
		builders.renderCss.addBlock( deindent`
			components.push({
				filename: ${name}.filename,
				css: ${JSON.stringify( processCss( parsed ) )},
				map: null // TODO
			});
		` );
	}

	if ( templateProperties.components ) {
		builders.renderCss.addBlock( deindent`
			var seen = {};

			function addComponent ( component ) {
				var result = component.renderCss();
				result.components.forEach( x => {
					if ( seen[ x.filename ] ) return;
					seen[ x.filename ] = true;
					components.push( x );
				});
			}
		` );

		templateProperties.components.properties.forEach( prop => {
			builders.renderCss.addLine( `addComponent( template.components.${prop.key.name} );` );
		});
	}

	builders.renderCss.addBlock( deindent`
		return {
			css: components.map( x => x.css ).join( '\\n' ),
			map: null,
			components
		};
	` );

	if ( parsed.js ) {
		builders.main.addBlock( `[✂${parsed.js.content.start}-${parsed.js.content.end}✂]` );
	}

	builders.main.addBlock( deindent`
		var ${name} = {};

		${name}.filename = ${JSON.stringify( options.filename )};

		${name}.render = function ( root, options ) {
			${builders.render}
		};

		${name}.renderCss = function () {
			${builders.renderCss}
		};

		var escaped = {
			'"': '&quot;',
			"'": '&39;',
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;'
		};

		function __escape ( html ) {
			return String( html ).replace( /["'&<>]/g, match => escaped[ match ] );
		}
	` );

	const result = builders.main.toString();

	return generator.generate( result, options, { name, format } );
}

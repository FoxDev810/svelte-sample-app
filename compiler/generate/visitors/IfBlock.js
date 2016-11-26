import deindent from '../utils/deindent.js';
import counter from '../utils/counter.js';

export default {
	enter ( generator, node ) {
		const i = generator.counters.if++;
		const name = `ifBlock_${i}`;
		const renderer = `renderIfBlock_${i}`;

		const elseName = `elseBlock_${i}`;
		const elseRenderer = `renderElseBlock_${i}`;

		generator.addSourcemapLocations( node.expression );
		const { snippet } = generator.contextualise( node.expression );

		generator.current.initStatements.push( deindent`
			var ${name}_anchor = document.createComment( ${JSON.stringify( `#if ${generator.source.slice( node.expression.start, node.expression.end )}` )} );
			${generator.current.target}.appendChild( ${name}_anchor );
		` );

		if ( node.else ) {
			generator.current.initStatements.push( deindent`
				var ${name} = null;
				var ${elseName} = null;

				if ( ${snippet} ) {
					${name} = ${renderer}( ${generator.current.params}, component, ${generator.current.target}, ${name}_anchor );
				} else {
					${elseName} = ${elseRenderer}( ${generator.current.params}, component, ${generator.current.target}, ${name}_anchor );
				}
			` );
		} else {
			generator.current.initStatements.push( deindent`
				var ${name} = ${snippet} ? ${renderer}( ${generator.current.params}, component, ${generator.current.target}, ${name}_anchor ) : null;
			` );
		}

		const ifTrue = [ deindent`
			if ( !${name } ) {
				${name} = ${renderer}( ${generator.current.params}, component, ${generator.current.target}, ${name}_anchor );
			} else {
				${name}.update( changed, ${generator.current.params} );
			}
		` ];

		if ( node.else ) {
			ifTrue.push( deindent`
				if ( ${elseName } ) {
					${elseName}.teardown( true );
					${elseName} = null;
				}
			` );
		}

		const ifFalse = [ deindent`
			if ( ${name} ) {
				${name}.teardown( true );
				${name} = null;
			}
		` ];

		if ( node.else ) {
			ifFalse.push( deindent`
				if ( !${elseName } ) {
					${elseName} = ${elseRenderer}( ${generator.current.params}, component, ${generator.current.target}, ${name}_anchor );
				} else {
					${elseName}.update( changed, ${generator.current.params} );
				}
			` );
		}

		let update = deindent`
			if ( ${snippet} ) {
				${ifTrue.join( '\n\n' )}
			}

			else {
				${ifFalse.join( '\n\n' )}
			}
		`;

		if ( node.else ) {
			update += `\nif ( ${elseName} ) ${elseName}.update( changed, ${generator.current.params} );`;
		}

		generator.current.updateStatements.push( update );

		const teardownStatements = [
			`if ( ${name} ) ${name}.teardown( detach );`
		];

		if ( node.else ) {
			teardownStatements.push( `if ( ${elseName} ) ${elseName}.teardown( detach );` );
		}

		if ( generator.current.localElementDepth === 0 ) {
			teardownStatements.push( `if ( detach ) ${name}_anchor.parentNode.removeChild( ${name}_anchor );` );
		}

		generator.current.teardownStatements.push( teardownStatements.join( '\n' ) );

		generator.push({
			useAnchor: true,
			name: renderer,
			target: 'target',
			localElementDepth: 0,

			initStatements: [],
			updateStatements: [],
			teardownStatements: [],

			counter: counter()
		});
	},

	leave ( generator, node ) {
		generator.addRenderer( generator.current );

		if ( node.else ) {
			generator.visit( node.else );
		}

		generator.pop();
	}
};

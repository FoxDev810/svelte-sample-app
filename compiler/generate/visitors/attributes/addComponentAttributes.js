import deindent from '../../utils/deindent.js';

export default function addComponentAttributes ( generator, node, local ) {
	node.attributes.forEach( attribute => {
		if ( attribute.type === 'Attribute' ) {
			if ( attribute.value === true ) {
				// attributes without values, e.g. <textarea readonly>
				local.init.push( deindent`
					${local.name}.setAttribute( '${attribute.name}', true );
				` );
			}

			else if ( attribute.value.length === 1 ) {
				const value = attribute.value[0];

				let result = '';

				if ( value.type === 'Text' ) {
					// static attributes
					result = JSON.stringify( value.data );

					local.init.push( deindent`
						${local.name}.setAttribute( '${attribute.name}', ${result} );
					` );
				}

				else {
					// dynamic – but potentially non-string – attributes
					generator.contextualise( value.expression );
					result = `[✂${value.expression.start}-${value.expression.end}✂]`;

					local.update.push( deindent`
						${local.name}.setAttribute( '${attribute.name}', ${result} );
					` );
				}
			}

			else {
				const value = ( attribute.value[0].type === 'Text' ? '' : `"" + ` ) + (
					attribute.value.map( chunk => {
						if ( chunk.type === 'Text' ) {
							return JSON.stringify( chunk.data );
						} else {
							generator.addSourcemapLocations( chunk.expression );

							generator.contextualise( chunk.expression );
							return `( [✂${chunk.expression.start}-${chunk.expression.end}✂] )`;
						}
					}).join( ' + ' )
				);

				local.update.push( deindent`
					${local.name}.setAttribute( '${attribute.name}', ${value} );
				` );
			}
		}

		else if ( attribute.type === 'EventHandler' ) {
			// TODO verify that it's a valid callee (i.e. built-in or declared method)
			generator.addSourcemapLocations( attribute.expression );
			generator.code.insertRight( attribute.expression.start, 'component.' );

			const usedContexts = new Set();
			attribute.expression.arguments.forEach( arg => {
				const contexts = generator.contextualise( arg, true );

				contexts.forEach( context => {
					usedContexts.add( context );
					local.allUsedContexts.add( context );
				});
			});

			// TODO hoist event handlers? can do `this.__component.method(...)`
			const declarations = [...usedContexts].map( name => {
				if ( name === 'root' ) return 'var root = this.__svelte.root;';

				const listName = generator.current.listNames[ name ];
				const indexName = generator.current.indexNames[ name ];

				return `var ${listName} = this.__svelte.${listName}, ${indexName} = this.__svelte.${indexName}, ${name} = ${listName}[${indexName}]`;
			});

			const handlerName = generator.current.counter( `${attribute.name}Handler` );
			const handlerBody = ( declarations.length ? declarations.join( '\n' ) + '\n\n' : '' ) + `[✂${attribute.expression.start}-${attribute.expression.end}✂];`;

			if ( attribute.name in generator.events ) {
				local.init.push( deindent`
					const ${handlerName} = template.events.${attribute.name}( ${local.name}, function ( event ) {
						${handlerBody}
					});
				` );

				local.teardown.push( deindent`
					${handlerName}.teardown();
				` );
			} else {
				local.init.push( deindent`
					function ${handlerName} ( event ) {
						${handlerBody}
					}

					${local.name}.addEventListener( '${attribute.name}', ${handlerName}, false );
				` );

				local.teardown.push( deindent`
					${local.name}.removeEventListener( '${attribute.name}', ${handlerName}, false );
				` );
			}
		}

		else if ( attribute.type === 'Binding' ) {
			throw new Error( 'TODO component bindings' );
		}

		else if ( attribute.type === 'Ref' ) {
			generator.usesRefs = true;

			local.init.push( deindent`
				component.refs.${attribute.name} = ${local.name};
			` );

			local.teardown.push( deindent`
				component.refs.${attribute.name} = null;
			` );
		}

		else {
			throw new Error( `Not implemented: ${attribute.type}` );
		}
	});
}

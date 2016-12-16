import deindent from '../../../utils/deindent.js';
import getBuilders from '../utils/getBuilders.js';

export default {
	enter ( generator, node ) {
		const name = generator.getUniqueName( `eachBlock` );
		const renderer = generator.getUniqueName( `renderEachBlock` );
		const elseName = `${name}_else`;
		const iterations = `${name}_iterations`;
		const renderElse = `${renderer}_else`;
		const i = generator.current.getUniqueName( `i` );
		const { params } = generator.current;

		const listName = `${name}_value`;

		const isToplevel = generator.current.localElementDepth === 0;

		generator.addSourcemapLocations( node.expression );

		const { dependencies, snippet } = generator.contextualise( node.expression );

		const anchor = `${name}_anchor`;
		generator.fire( 'createAnchor', {
			name: anchor,
			description: `#each ${generator.source.slice( node.expression.start, node.expression.end )}`
		});

		generator.current.builders.init.addBlock( deindent`
			var ${name}_value = ${snippet};
			var ${iterations} = [];
			${node.else ? `var ${elseName} = null;` : ''}

			for ( var ${i} = 0; ${i} < ${name}_value.length; ${i} += 1 ) {
				${iterations}[${i}] = ${renderer}( ${params}, ${listName}, ${listName}[${i}], ${i}, component );
				${!isToplevel ? `${iterations}[${i}].mount( ${anchor}.parentNode, ${anchor} );` : ''}
			}
		` );
		if ( node.else ) {
			generator.current.builders.init.addBlock( deindent`
				if ( !${name}_value.length ) {
					${elseName} = ${renderElse}( ${params}, component );
					${!isToplevel ? `${elseName}.mount( ${anchor}.parentNode, ${anchor} );` : ''}
				}
			` );
		}

		if ( isToplevel ) {
			generator.current.builders.mount.addBlock( deindent`
				for ( var ${i} = 0; ${i} < ${iterations}.length; ${i} += 1 ) {
					${iterations}[${i}].mount( ${anchor}.parentNode, ${anchor} );
				}
			` );
			if ( node.else ) {
				generator.current.builders.mount.addBlock( deindent`
					if ( ${elseName} ) {
						${elseName}.mount( ${anchor}.parentNode, ${anchor} );
					}
				` );
			}
		}

		generator.current.builders.update.addBlock( deindent`
			var ${name}_value = ${snippet};

			for ( var ${i} = 0; ${i} < ${name}_value.length; ${i} += 1 ) {
				if ( !${iterations}[${i}] ) {
					${iterations}[${i}] = ${renderer}( ${params}, ${listName}, ${listName}[${i}], ${i}, component );
					${iterations}[${i}].mount( ${anchor}.parentNode, ${anchor} );
				} else {
					${iterations}[${i}].update( changed, ${params}, ${listName}, ${listName}[${i}], ${i} );
				}
			}

			for ( var ${i} = ${name}_value.length; ${i} < ${iterations}.length; ${i} += 1 ) {
				${iterations}[${i}].teardown( true );
			}

			${iterations}.length = ${listName}.length;
		` );

		if ( node.else ) {
			generator.current.builders.update.addBlock( deindent`
				if ( !${name}_value.length && ${elseName} ) {
					${elseName}.update( changed, ${params} );
				} else if ( !${name}_value.length ) {
					${elseName} = ${renderElse}( ${params}, component );
					${elseName}.mount( ${anchor}.parentNode, ${anchor} );
				} else if ( ${elseName} ) {
					${elseName}.teardown( true );
				}
			` );
		}

		generator.current.builders.teardown.addBlock( deindent`
			for ( var ${i} = 0; ${i} < ${iterations}.length; ${i} += 1 ) {
				${iterations}[${i}].teardown( ${isToplevel ? 'detach' : 'false'} );
			}
		` );

		if ( node.else ) {
			generator.current.builders.teardown.addBlock( deindent`
				if ( ${elseName} ) {
					${elseName}.teardown( ${isToplevel ? 'detach' : 'false'} );
				}
			` );
		}

		if ( node.else ) {
			generator.fire( 'generateBlock', {
				node: node.else,
				name: renderElse
			});
		}

		const indexNames = Object.assign( {}, generator.current.indexNames );
		const indexName = indexNames[ node.context ] = ( node.index || `${node.context}__index` );

		const listNames = Object.assign( {}, generator.current.listNames );
		listNames[ node.context ] = listName;

		const contexts = Object.assign( {}, generator.current.contexts );
		contexts[ node.context ] = true;

		const indexes = Object.assign( {}, generator.current.indexes );
		if ( node.index ) indexes[ indexName ] = node.context;

		const contextDependencies = Object.assign( {}, generator.current.contextDependencies );
		contextDependencies[ node.context ] = dependencies;

		const blockParams = generator.current.params + `, ${listName}, ${node.context}, ${indexName}`;

		generator.push({
			name: renderer,
			target: 'target',
			expression: node.expression,
			context: node.context,
			localElementDepth: 0,

			contextDependencies,
			contexts,
			indexes,

			indexNames,
			listNames,
			params: blockParams,

			builders: getBuilders(),
			getUniqueName: generator.getUniqueNameMaker()
		});

		Object.keys( contexts ).forEach( contextName => {
			const listName = listNames[ contextName ];
			const indexName = indexNames[ contextName ];

			generator.current.builders.update.addLine(
				`var ${contextName} = ${listName}[${indexName}];`
			);
		});
	},

	leave ( generator ) {
		generator.fire( 'addRenderer', generator.current );
		generator.pop();
	}
};

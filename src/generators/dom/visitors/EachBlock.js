import deindent from '../../../utils/deindent.js';
import visit from '../visit.js';

export default function visitEachBlock ( generator, block, state, node ) {
	const each_block = generator.getUniqueName( `each_block` );
	const create_each_block = node._block.name;
	const each_block_value = node._block.listName;
	const iterations = block.getUniqueName( `${each_block}_iterations` );
	const i = block.alias( `i` );
	const params = block.params.join( ', ' );
	const anchor = node.needsAnchor ? block.getUniqueName( `${each_block}_anchor` ) : ( node.next && node.next._state.name ) || 'null';

	const mountOrIntro = node._block.hasIntroMethod ? 'intro' : 'mount';
	const vars = { each_block, create_each_block, each_block_value, iterations, i, params, anchor, mountOrIntro };

	const { snippet } = block.contextualise( node.expression );

	block.builders.create.addLine( `var ${each_block_value} = ${snippet};` );
	block.builders.create.addLine( `var ${iterations} = [];` );

	if ( node.key ) {
		keyed( generator, block, state, node, snippet, vars );
	} else {
		unkeyed( generator, block, state, node, snippet, vars );
	}

	const isToplevel = !state.parentNode;

	if ( isToplevel ) {
		block.builders.mount.addBlock( deindent`
			for ( var ${i} = 0; ${i} < ${iterations}.length; ${i} += 1 ) {
				${iterations}[${i}].${mountOrIntro}( ${block.target}, null );
			}
		` );
	}

	if ( node.needsAnchor ) {
		block.addElement( anchor, `${generator.helper( 'createComment' )}()`, state.parentNode, true );
	} else if ( node.next ) {
		node.next.usedAsAnchor = true;
	}

	block.builders.destroy.addBlock(
		`${generator.helper( 'destroyEach' )}( ${iterations}, ${isToplevel ? 'detach' : 'false'}, 0 );` );

	if ( node.else ) {
		const each_block_else = generator.getUniqueName( `${each_block}_else` );

		block.builders.create.addLine( `var ${each_block_else} = null;` );

		// TODO neaten this up... will end up with an empty line in the block
		block.builders.create.addBlock( deindent`
			if ( !${each_block_value}.length ) {
				${each_block_else} = ${node.else._block.name}( ${params}, ${block.component} );
				${!isToplevel ? `${each_block_else}.${mountOrIntro}( ${state.parentNode}, null );` : ''}
			}
		` );

		block.builders.mount.addBlock( deindent`
			if ( ${each_block_else} ) {
				${each_block_else}.${mountOrIntro}( ${state.parentNode || block.target}, null );
			}
		` );

		const parentNode = state.parentNode || `${anchor}.parentNode`;

		if ( node.else._block.hasUpdateMethod ) {
			block.builders.update.addBlock( deindent`
				if ( !${each_block_value}.length && ${each_block_else} ) {
					${each_block_else}.update( changed, ${params} );
				} else if ( !${each_block_value}.length ) {
					${each_block_else} = ${node.else._block.name}( ${params}, ${block.component} );
					${each_block_else}.${mountOrIntro}( ${parentNode}, ${anchor} );
				} else if ( ${each_block_else} ) {
					${each_block_else}.destroy( true );
					${each_block_else} = null;
				}
			` );
		} else {
			block.builders.update.addBlock( deindent`
				if ( ${each_block_value}.length ) {
					if ( ${each_block_else} ) {
						${each_block_else}.destroy( true );
						${each_block_else} = null;
					}
				} else if ( !${each_block_else} ) {
					${each_block_else} = ${node.else._block.name}( ${params}, ${block.component} );
					${each_block_else}.${mountOrIntro}( ${parentNode}, ${anchor} );
				}
			` );
		}


		block.builders.destroy.addBlock( deindent`
			if ( ${each_block_else} ) {
				${each_block_else}.destroy( ${isToplevel ? 'detach' : 'false'} );
			}
		` );
	}

	node.children.forEach( child => {
		visit( generator, node._block, node._state, child );
	});

	if ( node.else ) {
		node.else.children.forEach( child => {
			visit( generator, node.else._block, node.else._state, child );
		});
	}
}

function keyed ( generator, block, state, node, snippet, { each_block, create_each_block, each_block_value, iterations, i, params, anchor, mountOrIntro } ) {
	const fragment = block.getUniqueName( 'fragment' );
	const value = block.getUniqueName( 'value' );
	const key = block.getUniqueName( 'key' );
	const lookup = block.getUniqueName( `${each_block}_lookup` );
	const keys = block.getUniqueName( `${each_block}_keys` );
	const iteration = block.getUniqueName( `${each_block}_iteration` );
	const _iterations = block.getUniqueName( `_${each_block}_iterations` );

	if ( node.children[0] && node.children[0].type === 'Element' ) { // TODO or text/tag/raw
		node._block.first = node.children[0]._state.parentNode; // TODO this is highly confusing
	} else {
		node._block.first = node._block.getUniqueName( 'first' );
		node._block.addElement( node._block.first, `${generator.helper( 'createComment' )}()`, null, true );
	}

	block.builders.create.addBlock( deindent`
		var ${lookup} = Object.create( null );

		for ( var ${i} = 0; ${i} < ${each_block_value}.length; ${i} += 1 ) {
			var ${key} = ${each_block_value}[${i}].${node.key};
			${iterations}[${i}] = ${lookup}[ ${key} ] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component}, ${key} );
			${state.parentNode && `${iterations}[${i}].${mountOrIntro}( ${state.parentNode}, null );`}
		}
	` );

	const consequent = node._block.hasUpdateMethod ?
		deindent`
			${_iterations}[${i}] = ${lookup}[ ${key} ] = ${lookup}[ ${key} ];
			${lookup}[ ${key} ].update( changed, ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i} );
		` :
		`${_iterations}[${i}] = ${lookup}[ ${key} ] = ${lookup}[ ${key} ];`;

	const parentNode = state.parentNode || `${anchor}.parentNode`;

	const hasIntros = node._block.hasIntroMethod;

	const destroy = node._block.hasOutroMethod ?
		deindent`
			function outro ( key ) {
				${lookup}[ key ].outro( function () {
					${lookup}[ key ].destroy( true );
					${lookup}[ key ] = null;
				});
			}

			for ( var ${i} = 0; ${i} < ${iterations}.length; ${i} += 1 ) {
				${key} = ${iterations}[${i}].key;
				if ( !${keys}[ ${key} ] ) outro( ${key} );
			}
		` :
		deindent`
			for ( var ${i} = 0; ${i} < ${iterations}.length; ${i} += 1 ) {
				var ${iteration} = ${iterations}[${i}];
				if ( !${keys}[ ${iteration}.key ] ) ${iteration}.destroy( true );
			}
		`;

	block.builders.update.addBlock( deindent`
		var ${each_block_value} = ${snippet};
		var ${_iterations} = [];
		var ${keys} = Object.create( null );

		var ${fragment} = document.createDocumentFragment();

		// create new iterations as necessary
		for ( var ${i} = 0; ${i} < ${each_block_value}.length; ${i} += 1 ) {
			var ${value} = ${each_block_value}[${i}];
			var ${key} = ${value}.${node.key};
			${keys}[ ${key} ] = true;

			if ( ${lookup}[ ${key} ] ) {
				${consequent}
				${hasIntros && `${_iterations}[${i}].mount( ${fragment}, null );`}
			} else {
				${_iterations}[${i}] = ${lookup}[ ${key} ] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component}, ${key} );
				${hasIntros && `${_iterations}[${i}].intro( ${fragment}, null );`}
			}

			${!hasIntros && `${_iterations}[${i}].mount( ${fragment}, null );`}
		}

		// remove old iterations
		${destroy}

		${parentNode}.insertBefore( ${fragment}, ${anchor} );

		${iterations} = ${_iterations};
	` );
}

function unkeyed ( generator, block, state, node, snippet, { create_each_block, each_block_value, iterations, i, params, anchor, mountOrIntro } ) {
	block.builders.create.addBlock( deindent`
		for ( var ${i} = 0; ${i} < ${each_block_value}.length; ${i} += 1 ) {
			${iterations}[${i}] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component} );
			${state.parentNode && `${iterations}[${i}].${mountOrIntro}( ${state.parentNode}, null );`}
		}
	` );

	const dependencies = block.findDependencies( node.expression );
	const allDependencies = new Set( node._block.dependencies );
	dependencies.forEach( dependency => {
		allDependencies.add( dependency );
	});

	const condition = Array.from( allDependencies )
		.map( dependency => `'${dependency}' in changed` )
		.join( ' || ' );

	const parentNode = state.parentNode || `${anchor}.parentNode`;

	if ( condition !== '' ) {
		const forLoopBody = node._block.hasUpdateMethod ?
			deindent`
				if ( ${iterations}[${i}] ) {
					${iterations}[${i}].update( changed, ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i} );
				} else {
					${iterations}[${i}] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component} );
					${iterations}[${i}].${mountOrIntro}( ${parentNode}, ${anchor} );
				}
			` :
			deindent`
				${iterations}[${i}] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component} );
				${iterations}[${i}].${mountOrIntro}( ${parentNode}, ${anchor} );
			`;

		const start = node._block.hasUpdateMethod ? '0' : `${iterations}.length`;

		const destroy = node._block.hasOutroMethod ?
			deindent`
				function outro ( i ) {
					if ( ${iterations}[i] ) {
						${iterations}[i].outro( function () {
							${iterations}[i].destroy( true );
							${iterations}[i] = null;
						});
					}
				}

				for ( ; ${i} < ${iterations}.length; ${i} += 1 ) outro( ${i} );
			` :
			deindent`
				${generator.helper( 'destroyEach' )}( ${iterations}, true, ${each_block_value}.length );
				${iterations}.length = ${each_block_value}.length;
			`;

		block.builders.update.addBlock( deindent`
			var ${each_block_value} = ${snippet};

			if ( ${condition} ) {
				for ( var ${i} = ${start}; ${i} < ${each_block_value}.length; ${i} += 1 ) {
					${forLoopBody}
				}

				${destroy}
			}
		` );
	}
}
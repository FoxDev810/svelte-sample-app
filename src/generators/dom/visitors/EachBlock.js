import CodeBuilder from '../../../utils/CodeBuilder.js';
import deindent from '../../../utils/deindent.js';
import visit from '../visit.js';

export default function visitEachBlock ( generator, block, state, node ) {
	const each_block = generator.getUniqueName( `each_block` );
	const create_each_block = node._block.name;
	const each_block_value = node._block.listName;
	const iterations = block.getUniqueName( `${each_block}_iterations` );
	const i = block.getUniqueName( `i` );
	const params = block.params.join( ', ' );
	const anchor = block.getUniqueName( `${each_block}_anchor` );

	const vars = { each_block, create_each_block, each_block_value, iterations, i, params, anchor };

	const { snippet } = block.contextualise( node.expression );

	block.createAnchor( anchor, state.parentNode );
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
				${iterations}[${i}].mount( ${block.target}, ${anchor} );
			}
		` );
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
				${!isToplevel ? `${each_block_else}.mount( ${state.parentNode}, ${anchor} );` : ''}
			}
		` );

		block.builders.mount.addBlock( deindent`
			if ( ${each_block_else} ) {
				${each_block_else}.mount( ${state.parentNode || block.target}, ${anchor} );
			}
		` );

		block.builders.update.addBlock( deindent`
			if ( !${each_block_value}.length && ${each_block_else} ) {
				${each_block_else}.update( changed, ${params} );
			} else if ( !${each_block_value}.length ) {
				${each_block_else} = ${node.else._block.name}( ${params}, ${block.component} );
				${each_block_else}.mount( ${anchor}.parentNode, ${anchor} );
			} else if ( ${each_block_else} ) {
				${each_block_else}.destroy( true );
			}
		` );

		block.builders.destroy.addBlock( deindent`
			if ( ${each_block_else} ) {
				${each_block_else}.destroy( ${isToplevel ? 'detach' : 'false'} );
			}
		` );
	}

	const childBlock = node._block;

	const childState = Object.assign( {}, state, {
		parentNode: null,
		inEachBlock: true
	});

	node.children.forEach( child => {
		visit( generator, childBlock, childState, child );
	});

	generator.addBlock( childBlock );

	if ( node.else ) {
		node.else.children.forEach( child => {
			visit( generator, node.else._block, childState, child );
		});

		generator.addBlock( node.else._block );
	}
}

function keyed ( generator, block, state, node, snippet, { each_block, create_each_block, each_block_value, iterations, i, params, anchor } ) {
	const fragment = block.getUniqueName( 'fragment' );
	const value = block.getUniqueName( 'value' );
	const key = block.getUniqueName( 'key' );
	const lookup = block.getUniqueName( `${each_block}_lookup` );
	const _lookup = block.getUniqueName( `_${each_block}_lookup` );
	const iteration = block.getUniqueName( `${each_block}_iteration` );
	const _iterations = block.getUniqueName( `_${each_block}_iterations` );

	block.builders.create.addLine( `var ${lookup} = Object.create( null );` );

	const create = new CodeBuilder();

	create.addBlock( deindent`
		var ${key} = ${each_block_value}[${i}].${node.key};
		${iterations}[${i}] = ${lookup}[ ${key} ] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component}${node.key ? `, ${key}` : `` } );
	` );

	if ( state.parentNode ) {
		create.addLine(
			`${iterations}[${i}].mount( ${state.parentNode}, ${anchor} );`
		);
	}

	block.builders.create.addBlock( deindent`
		for ( var ${i} = 0; ${i} < ${each_block_value}.length; ${i} += 1 ) {
			${create}
		}
	` );

	block.builders.update.addBlock( deindent`
		var ${each_block_value} = ${snippet};
		var ${_iterations} = [];
		var ${_lookup} = Object.create( null );

		var ${fragment} = document.createDocumentFragment();

		// create new iterations as necessary
		for ( var ${i} = 0; ${i} < ${each_block_value}.length; ${i} += 1 ) {
			var ${value} = ${each_block_value}[${i}];
			var ${key} = ${value}.${node.key};

			if ( ${lookup}[ ${key} ] ) {
				${_iterations}[${i}] = ${_lookup}[ ${key} ] = ${lookup}[ ${key} ];
				${_lookup}[ ${key} ].update( changed, ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i} );
			} else {
				${_iterations}[${i}] = ${_lookup}[ ${key} ] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component}${node.key ? `, ${key}` : `` } );
			}

			${_iterations}[${i}].mount( ${fragment}, null );
		}

		// remove old iterations
		for ( var ${i} = 0; ${i} < ${iterations}.length; ${i} += 1 ) {
			var ${iteration} = ${iterations}[${i}];
			if ( !${_lookup}[ ${iteration}.key ] ) {
				${iteration}.destroy( true );
			}
		}

		${anchor}.parentNode.insertBefore( ${fragment}, ${anchor} );

		${iterations} = ${_iterations};
		${lookup} = ${_lookup};
	` );
}

function unkeyed ( generator, block, state, node, snippet, { create_each_block, each_block_value, iterations, i, params, anchor } ) {
	const create = new CodeBuilder();

	create.addLine(
		`${iterations}[${i}] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component} );`
	);

	if ( state.parentNode ) {
		create.addLine(
			`${iterations}[${i}].mount( ${state.parentNode}, ${anchor} );`
		);
	}

	block.builders.create.addBlock( deindent`
		for ( var ${i} = 0; ${i} < ${each_block_value}.length; ${i} += 1 ) {
			${create}
		}
	` );

	const { dependencies } = block.contextualise( node.expression );
	const allDependencies = new Set( block.dependencies );
	dependencies.forEach( dependency => {
		allDependencies.add( dependency );
	});

	const condition = Array.from( allDependencies )
		.map( dependency => `'${dependency}' in changed` )
		.join( ' || ' );

	if ( condition !== '' ) {
		block.builders.update.addBlock( deindent`
			var ${each_block_value} = ${snippet};

			if ( ${condition} ) {
				for ( var ${i} = 0; ${i} < ${each_block_value}.length; ${i} += 1 ) {
					if ( !${iterations}[${i}] ) {
						${iterations}[${i}] = ${create_each_block}( ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i}, ${block.component} );
						${iterations}[${i}].mount( ${anchor}.parentNode, ${anchor} );
					} else {
						${iterations}[${i}].update( changed, ${params}, ${each_block_value}, ${each_block_value}[${i}], ${i} );
					}
				}

				${generator.helper( 'destroyEach' )}( ${iterations}, true, ${each_block_value}.length );

				${iterations}.length = ${each_block_value}.length;
			}
		` );
	}
}
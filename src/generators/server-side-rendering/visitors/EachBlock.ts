import visit from '../visit';

export default function visitEachBlock ( generator, block, node ) {
	const { dependencies, snippet } = block.contextualise( node.expression );

	const open = `\${ ${snippet}.map( ${ node.index ? `( ${node.context}, ${node.index} )` : node.context} => \``;
	generator.append( open );

	// TODO should this be the generator's job? It's duplicated between
	// here and the equivalent DOM compiler visitor
	const contexts = new Map( block.contexts );
	contexts.set( node.context, node.context );

	const indexes = new Map( block.indexes );
	if ( node.index ) indexes.set( node.index, node.context );

	const contextDependencies = new Map( block.contextDependencies );
	contextDependencies.set( node.context, dependencies );

	const childBlock = block.child({
		contexts,
		indexes,
		contextDependencies
	});

	node.children.forEach( child => {
		visit( generator, childBlock, child );
	});

	const close = `\` ).join( '' )}`;
	generator.append( close );
}
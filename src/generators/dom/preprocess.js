import Block from './Block.js';

function isElseIf ( node ) {
	return node && node.children.length === 1 && node.children[0].type === 'IfBlock';
}

const preprocessors = {
	MustacheTag: ( generator, block, node ) => {
		const dependencies = block.findDependencies( node.expression );
		block.addDependencies( dependencies );
	},

	IfBlock: ( generator, block, node ) => {
		const blocks = [];
		let dynamic = false;

		function attachBlocks ( node ) {
			const dependencies = block.findDependencies( node.expression );
			block.addDependencies( dependencies );

			node._block = block.child({
				name: generator.getUniqueName( `create_if_block` )
			});

			blocks.push( node._block );
			preprocessChildren( generator, node._block, node.children );

			if ( node._block.dependencies.size > 0 ) {
				dynamic = true;
				block.addDependencies( node._block.dependencies );
			}

			if ( isElseIf( node.else ) ) {
				attachBlocks( node.else.children[0] );
			} else if ( node.else ) {
				node.else._block = block.child({
					name: generator.getUniqueName( `create_if_block` )
				});

				blocks.push( node.else._block );
				preprocessChildren( generator, node.else._block, node.else.children );

				if ( node.else._block.dependencies.size > 0 ) {
					dynamic = true;
					block.addDependencies( node.else._block.dependencies );
				}
			}
		}

		attachBlocks( node );

		blocks.forEach( block => {
			block.hasUpdateMethod = dynamic;
		});

		generator.blocks.push( ...blocks );
	},

	EachBlock: ( generator, block, node ) => {
		const dependencies = block.findDependencies( node.expression );
		block.addDependencies( dependencies );

		const indexNames = new Map( block.indexNames );
		const indexName = node.index || block.getUniqueName( `${node.context}_index` );
		indexNames.set( node.context, indexName );

		const listNames = new Map( block.listNames );
		const listName = block.getUniqueName( `each_block_value` );
		listNames.set( node.context, listName );

		const context = generator.getUniqueName( node.context );
		const contexts = new Map( block.contexts );
		contexts.set( node.context, context );

		const indexes = new Map( block.indexes );
		if ( node.index ) indexes.set( indexName, node.context );

		const contextDependencies = new Map( block.contextDependencies );
		contextDependencies.set( node.context, dependencies );

		node._block = block.child({
			name: generator.getUniqueName( 'create_each_block' ),
			expression: node.expression,
			context: node.context,
			key: node.key,

			contextDependencies,
			contexts,
			indexes,

			listName,
			indexName,

			indexNames,
			listNames,
			params: block.params.concat( listName, context, indexName )
		});

		generator.blocks.push( node._block );
		preprocessChildren( generator, node._block, node.children );
		block.addDependencies( node._block.dependencies );
		node._block.hasUpdateMethod = node._block.dependencies.size > 0;

		if ( node.else ) {
			node.else._block = block.child({
				name: generator.getUniqueName( `${node._block.name}_else` )
			});

			generator.blocks.push( node.else._block );
			preprocessChildren( generator, node.else._block, node.else.children );
			node.else._block.hasUpdateMethod = node.else._block.dependencies.size > 0;
		}
	},

	Element: ( generator, block, node ) => {
		node.attributes.forEach( attribute => {
			if ( attribute.type === 'Attribute' && attribute.value !== true ) {
				attribute.value.forEach( chunk => {
					if ( chunk.type !== 'Text' ) {
						const dependencies = block.findDependencies( chunk.expression );
						block.addDependencies( dependencies );
					}
				});
			}

			else if ( attribute.type === 'Binding' ) {
				const dependencies = block.findDependencies( attribute.value );
				block.addDependencies( dependencies );
			}
		});

		const isComponent = generator.components.has( node.name ) || node.name === ':Self';

		if ( node.children.length ) {
			if ( isComponent ) {
				const name = block.getUniqueName( ( node.name === ':Self' ? generator.name : node.name ).toLowerCase() );

				node._block = block.child({
					name: generator.getUniqueName( `create_${name}_yield_fragment` )
				});

				generator.blocks.push( node._block );
				preprocessChildren( generator, node._block, node.children );
				block.addDependencies( node._block.dependencies );
				node._block.hasUpdateMethod = node._block.dependencies.size > 0;
			}

			else {
				preprocessChildren( generator, block, node.children );
			}
		}
	}
};

preprocessors.RawMustacheTag = preprocessors.MustacheTag;

function preprocessChildren ( generator, block, children ) {
	children.forEach( child => {
		const preprocess = preprocessors[ child.type ];
		if ( preprocess ) preprocess( generator, block, child );
	});
}

export default function preprocess ( generator, children ) {
	const block = new Block({
		generator,
		name: generator.alias( 'create_main_fragment' ),
		key: null,

		contexts: new Map(),
		indexes: new Map(),
		contextDependencies: new Map(),

		params: [ 'root' ],
		indexNames: new Map(),
		listNames: new Map(),

		dependencies: new Set()
	});

	generator.blocks.push( block );
	preprocessChildren( generator, block, children );
	block.hasUpdateMethod = block.dependencies.size > 0;

	return block;
}
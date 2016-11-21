import deindent from '../utils/deindent.js';
import addComponentAttributes from './attributes/addComponentAttributes.js';
import addElementAttributes from './attributes/addElementAttributes.js';

export default {
	enter ( generator, node ) {
		const isComponent = node.name in generator.components;
		const name = generator.current.counter( isComponent ? `${node.name[0].toLowerCase()}${node.name.slice( 1 )}` : node.name );

		const local = {
			name,
			namespace: name === 'svg' ? 'http://www.w3.org/2000/svg' : generator.current.namespace,
			allUsedContexts: new Set(),

			init: [],
			update: [],
			teardown: []
		};

		if ( isComponent ) {
			addComponentAttributes( generator, node, local );

			local.init.unshift( deindent`
				var ${name} = new template.components.${node.name}({
					target: ${generator.current.target}
				});
			` );

			local.teardown.push( `${name}.teardown();` );
		}

		else {
			addElementAttributes( generator, node, local );

			if ( local.allUsedContexts.size ) {
				local.init.push( deindent`
					${name}.__svelte = {};
				` );

				const declarations = [...local.allUsedContexts].map( contextName => {
					if ( contextName === 'root' ) return `${name}.__svelte.root = root;`;

					const listName = generator.current.listNames[ contextName ];
					const indexName = generator.current.indexNames[ contextName ];

					return `${name}.__svelte.${listName} = ${listName};\n${name}.__svelte.${indexName} = ${indexName};`;
				}).join( '\n' );

				local.update.push( declarations );
			}

			local.init.unshift(
				local.namespace ?
					`var ${name} = document.createElementNS( '${local.namespace}', '${node.name}' );` :
					`var ${name} = document.createElement( '${node.name}' );`
			);

			local.teardown.push( `${name}.parentNode.removeChild( ${name} );` );
		}

		generator.current.initStatements.push( local.init.join( '\n' ) );
		if ( local.update.length ) generator.current.updateStatements.push( local.update.join( '\n' ) );
		generator.current.teardownStatements.push( local.teardown.join( '\n' ) );

		generator.current = Object.assign( {}, generator.current, {
			isComponent,
			namespace: local.namespace,
			target: name,
			parent: generator.current
		});
	},

	leave ( generator ) {
		const name = generator.current.target;
		const isComponent = generator.current.isComponent;

		generator.current = generator.current.parent;

		if ( isComponent ) return;

		if ( generator.current.useAnchor && generator.current.target === 'target' ) {
			generator.current.initStatements.push( deindent`
				anchor.parentNode.insertBefore( ${name}, anchor );
			` );
		} else {
			generator.current.initStatements.push( deindent`
				${generator.current.target}.appendChild( ${name} );
			` );
		}
	}
};

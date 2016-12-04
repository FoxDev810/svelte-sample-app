import deindent from '../utils/deindent.js';
import addComponentAttributes from './attributes/addComponentAttributes.js';
import addElementAttributes from './attributes/addElementAttributes.js';
import counter from '../utils/counter.js';

export default {
	enter ( generator, node ) {
		const hasChildren = node.children.length > 0;
		const isComponent = node.name in generator.components;
		const name = generator.current.counter( isComponent ? `${node.name[0].toLowerCase()}${node.name.slice( 1 )}` : node.name );

		const local = {
			name,
			namespace: name === 'svg' ? 'http://www.w3.org/2000/svg' : generator.current.namespace,
			isComponent,

			allUsedContexts: new Set(),

			init: [],
			mount: [],
			update: [],
			teardown: []
		};

		const isToplevel = generator.current.localElementDepth === 0;

		if ( isComponent ) {
			generator.hasComponents = true;

			addComponentAttributes( generator, node, local );

			const componentInitProperties = [
				`target: ${!isToplevel ? generator.current.target: 'null'}`,
				'root: component.root || component'
			];
			// Component has children
			if ( hasChildren ) {
				const yieldName = `render${name}YieldFragment`;

				// {{YIELD STUFF}}
				generator.push({
					useAnchor: true,
					name: generator.current.counter(yieldName),
					target: 'target',
					localElementDepth: 0,

					initStatements: [],
					mountStatements: [],
					updateStatements: [],
					teardownStatements: [],

					counter: counter()
				});

				node.children.forEach( generator.visit );
				generator.addRenderer( generator.current );
				generator.pop();

				// Don't render children twice
				node.children = [];

				generator.current.initStatements.push(`var ${name}_yieldFragment = ${yieldName}( root, component );`);
				generator.current.updateStatements.push(`${name}_yieldFragment.update ( changed, root );`);

				componentInitProperties.push(`yield: ${name}_yieldFragment`);
			}

			const statements = [];

			if ( local.staticAttributes.length || local.dynamicAttributes.length || local.bindings.length ) {
				const initialProps = local.staticAttributes
					.concat( local.dynamicAttributes )
					.map( attribute => `${attribute.name}: ${attribute.value}` );

				if ( initialProps.length ) {
					statements.push( deindent`
						var ${name}_initialData = {
							${initialProps.join( ',\n' )}
						};
					` );
				} else {
					statements.push( `var ${name}_initialData = {};` );
				}

				if ( local.bindings.length ) {
					const bindings = local.bindings.map( binding => {
						const parts = binding.value.split( '.' );
						const tail = parts.pop();
						return `if ( '${tail}' in ${parts.join( '.' )} ) ${name}_initialData.${binding.name} = ${binding.value};`;
					});

					statements.push( bindings.join( '\n' ) );
				}
				componentInitProperties.push(`data: ${name}_initialData`);
			}

			local.init.unshift( deindent`
				${statements.join( '\n\n' )}

				var ${name} = new template.components.${node.name}({
					${componentInitProperties.join(',\n')}
				});
			` );


			if ( isToplevel ) {
				local.mount.unshift( `${name}.mount( target, anchor );` );
			}

			if ( local.dynamicAttributes.length ) {
				const updates = local.dynamicAttributes.map( attribute => {
					return deindent`
						if ( ${attribute.dependencies.map( dependency => `'${dependency}' in changed` ).join( '||' )} ) ${name}_changes.${attribute.name} = ${attribute.value};
					`;
				});

				local.update.push( deindent`
					var ${name}_changes = {};

					${updates.join( '\n' )}

					if ( Object.keys( ${name}_changes ).length ) ${name}.set( ${name}_changes );
				` );
			}

			local.teardown.push( `${name}.teardown( ${isToplevel ? 'detach' : 'false'} );` );
		}

		else {
			addElementAttributes( generator, node, local );

			if ( local.allUsedContexts.size ) {
				const contextNames = [...local.allUsedContexts];

				const initialProps = contextNames.map( contextName => {
					if ( contextName === 'root' ) return `root: root`;

					const listName = generator.current.listNames[ contextName ];
					const indexName = generator.current.indexNames[ contextName ];

					return `${listName}: ${listName},\n${indexName}: ${indexName}`;
				}).join( ',\n' );

				const updates = contextNames.map( contextName => {
					if ( contextName === 'root' ) return `${name}.__svelte.root = root;`;

					const listName = generator.current.listNames[ contextName ];
					const indexName = generator.current.indexNames[ contextName ];

					return `${name}.__svelte.${listName} = ${listName};\n${name}.__svelte.${indexName} = ${indexName};`;
				}).join( '\n' );

				local.init.push( deindent`
					${name}.__svelte = {
						${initialProps}
					};
				` );

				local.update.push( updates );
			}

			let render = local.namespace ?
				`var ${name} = document.createElementNS( '${local.namespace}', '${node.name}' );` :
				`var ${name} = document.createElement( '${node.name}' );`;

			if ( generator.cssId && !generator.current.elementDepth ) {
				render += `\n${name}.setAttribute( '${generator.cssId}', '' );`;
			}

			local.init.unshift( render );
			if ( isToplevel ) {
				local.teardown.push( `if ( detach ) ${name}.parentNode.removeChild( ${name} );` );
			}
		}

		// special case – bound <option> without a value attribute
		if ( node.name === 'option' && !node.attributes.find( attribute => attribute.type === 'Attribute' && attribute.name === 'value' ) ) { // TODO check it's bound
			// const dynamic = node.children.length > 1 || node.children[0].type !== 'Text';
			// TODO do this in init for static values... have to do it in `leave`, because they don't exist yet
			local.update.push( `${name}.__value = ${name}.textContent` );
		}

		generator.current.initStatements.push( local.init.join( '\n' ) );
		if ( local.update.length ) generator.current.updateStatements.push( local.update.join( '\n' ) );
		if ( local.mount.length ) generator.current.mountStatements.push( local.mount.join( '\n' ) );
		generator.current.teardownStatements.push( local.teardown.join( '\n' ) );

		generator.push({
			isComponent,
			namespace: local.namespace,
			target: name,
			parent: generator.current,
			elementDepth: generator.current.elementDepth + 1,
			localElementDepth: generator.current.localElementDepth + 1
		});
	},

	leave ( generator ) {
		const name = generator.current.target;
		const isComponent = generator.current.isComponent;

		generator.pop();

		if ( isComponent ) return;

		generator.createMountStatement( name );
	}
};

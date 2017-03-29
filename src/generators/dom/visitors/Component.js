import deindent from '../../../utils/deindent.js';
import CodeBuilder from '../../../utils/CodeBuilder.js';
import addComponentAttributes from './attributes/addComponentAttributes.js';

function capDown ( name ) {
	return `${name[0].toLowerCase()}${name.slice( 1 )}`;
}

export default {
	enter ( generator, node ) {
		const hasChildren = node.children.length > 0;
		const { current } = generator;
		const name = current.getUniqueName( capDown( node.name === ':Self' ? generator.name : node.name ) );

		const local = {
			name,
			namespace: current.namespace,
			isComponent: true,

			allUsedContexts: [],

			init: new CodeBuilder(),
			update: new CodeBuilder()
		};

		const isToplevel = current.localElementDepth === 0;

		generator.hasComponents = true;

		addComponentAttributes( generator, node, local );

		if ( local.allUsedContexts.length ) {
			const initialProps = local.allUsedContexts.map( contextName => {
				if ( contextName === 'root' ) return `root: root`;

				const listName = current.listNames.get( contextName );
				const indexName = current.indexNames.get( contextName );

				return `${listName}: ${listName},\n${indexName}: ${indexName}`;
			}).join( ',\n' );

			const updates = local.allUsedContexts.map( contextName => {
				if ( contextName === 'root' ) return `${name}._context.root = root;`;

				const listName = current.listNames.get( contextName );
				const indexName = current.indexNames.get( contextName );

				return `${name}._context.${listName} = ${listName};\n${name}._context.${indexName} = ${indexName};`;
			}).join( '\n' );

			local.init.addBlock( deindent`
				${name}._context = {
					${initialProps}
				};
			` );

			local.update.addBlock( updates );
		}

		const componentInitProperties = [
			`target: ${!isToplevel ? current.target: 'null'}`,
			`_root: ${current.component}._root || ${current.component}`
		];

		// Component has children, put them in a separate {{yield}} block
		if ( hasChildren ) {
			const yieldName = generator.getUniqueName( `render_${name}_yield_fragment` );
			const params = current.params.join( ', ' );

			generator.generateBlock( node, yieldName );

			const yieldFragment = current.getUniqueName( `${name}_yield_fragment` );

			current.builders.init.addLine(
				`var ${yieldFragment} = ${yieldName}( ${params}, ${current.component} );`
			);

			current.builders.update.addLine(
				`${yieldFragment}.update( changed, ${params} );`
			);

			componentInitProperties.push( `_yield: ${yieldFragment}`);
		}

		const statements = [];

		if ( local.staticAttributes.length || local.dynamicAttributes.length || local.bindings.length ) {
			const initialProps = local.staticAttributes
				.concat( local.dynamicAttributes )
				.map( attribute => `${attribute.name}: ${attribute.value}` );
			const initialData = current.getUniqueName( `${name}_initial_data` );

			if ( initialProps.length ) {
				statements.push( deindent`
					var ${initialData} = {
						${initialProps.join( ',\n' )}
					};
				` );
			} else {
				statements.push( `var ${initialData} = {};` );
			}

			if ( local.bindings.length ) {
				const bindings = local.bindings.map( binding => {
					return `if ( ${binding.prop} in ${binding.obj} ) ${initialData}.${binding.name} = ${binding.value};`;
				});

				statements.push( bindings.join( '\n' ) );
			}
			componentInitProperties.push(`data: ${initialData}`);
		}

		const expression = node.name === ':Self' ? generator.name : generator.importedComponents.get( node.name ) || `${generator.alias( 'template' )}.components.${node.name}`;

		local.init.addBlockAtStart( deindent`
			${statements.join( '\n\n' )}
			var ${name} = new ${expression}({
				${componentInitProperties.join(',\n')}
			});
		` );

		if ( isToplevel ) {
			current.builders.mount.addLine( `${name}._fragment.mount( target, anchor );` );
		}

		if ( local.dynamicAttributes.length ) {
			const updates = local.dynamicAttributes.map( attribute => {
				if ( attribute.dependencies.length ) {
					return deindent`
						if ( ${attribute.dependencies.map( dependency => `'${dependency}' in changed` ).join( '||' )} ) ${name}_changes.${attribute.name} = ${attribute.value};
					`;
				}

				// TODO this is an odd situation to encounter – I *think* it should only happen with
				// each block indices, in which case it may be possible to optimise this
				return `${name}_changes.${attribute.name} = ${attribute.value};`;
			});

			local.update.addBlock( deindent`
				var ${name}_changes = {};

				${updates.join( '\n' )}

				if ( Object.keys( ${name}_changes ).length ) ${name}.set( ${name}_changes );
			` );
		}

		current.builders.teardown.addLine( `${name}.destroy( ${isToplevel ? 'detach' : 'false'} );` );

		current.builders.init.addBlock( local.init );
		if ( !local.update.isEmpty() ) current.builders.update.addBlock( local.update );

		generator.push({
			namespace: local.namespace,
			target: name,
			parent: current,
			localElementDepth: current.localElementDepth + 1,
			key: null
		});
	},

	leave ( generator ) {
		generator.pop();
	}
};

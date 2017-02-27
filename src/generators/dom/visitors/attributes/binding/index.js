import deindent from '../../../../../utils/deindent.js';
import isReference from '../../../../../utils/isReference.js';
import flattenReference from '../../../../../utils/flattenReference.js';

export default function createBinding ( generator, node, attribute, current, local ) {
	const parts = attribute.value.split( '.' );

	const deep = parts.length > 1;
	const contextual = parts[0] in current.contexts;

	if ( contextual ) local.allUsedContexts.add( parts[0] );

	if ( local.isComponent ) {
		let obj;
		let prop;
		let value;

		if ( contextual ) {
			obj = current.listNames[ parts[0] ];
			prop = current.indexNames[ parts[0] ];
			value = attribute.value;
		} else {
			prop = `'${parts.slice( -1 )}'`;
			obj = parts.length > 1 ? `root.${parts.slice( 0, -1 ).join( '.' )}` : `root`;
			value = `root.${attribute.value}`;
		}

		local.bindings.push({ name: attribute.name, value, obj, prop });
	}

	const handler = current.getUniqueName( `${local.name}ChangeHandler` );
	let setter;

	let eventName = 'change';
	if ( node.name === 'input' ) {
		const type = node.attributes.find( attr => attr.type === 'Attribute' && attr.name === 'type' );
		if ( !type || type.value[0].data === 'text' ) {
			// TODO in validation, should throw if type attribute is not static
			eventName = 'input';
		}
	}

	let value;

	if ( local.isComponent ) {
		value = 'value';
	} else if ( node.name === 'select' ) {
		// TODO <select multiple> – can use select.selectedOptions
		value = 'selectedOption && selectedOption.__value';
	} else {
		value = `${local.name}.${attribute.name}`;
	}

	if ( contextual ) {
		// find the top-level property that this is a child of
		let fragment = current;
		let prop = parts[0];

		do {
			if ( fragment.expression && fragment.context === prop ) {
				if ( !isReference( fragment.expression  ) ) {
					// TODO this should happen in prior validation step
					throw new Error( `${prop} is read-only, it cannot be bound` );
				}

				prop = flattenReference( fragment.expression ).name;
			}
		} while ( fragment = fragment.parent );

		const listName = current.listNames[ parts[0] ];
		const indexName = current.indexNames[ parts[0] ];

		const context = local.isComponent ? `_context` : `__svelte`;

		setter = deindent`
			var list = this.${context}.${listName};
			var index = this.${context}.${indexName};
			list[index]${parts.slice( 1 ).map( part => `.${part}` ).join( '' )} = ${value};

			component._set({ ${prop}: component.get( '${prop}' ) });
		`;
	} else if ( deep ) {
		setter = deindent`
			var ${parts[0]} = component.get( '${parts[0]}' );
			${parts[0]}.${parts.slice( 1 ).join( '.' )} = ${value};
			component._set({ ${parts[0]}: ${parts[0]} });
		`;
	} else {
		setter = `component._set({ ${attribute.value}: ${value} });`;
	}

	// special case
	if ( node.name === 'select' ) {
		setter = `var selectedOption = ${local.name}.selectedOptions[0] || ${local.name}.options[0];\n` + setter;
	}

	if ( local.isComponent ) {
		generator.hasComplexBindings = true;

		local.init.addBlock( deindent`
			var ${local.name}_updating = false;

			component._bindings.push( function () {
				if ( ${local.name}._torndown ) return;
				${local.name}.observe( '${attribute.name}', function ( value ) {
					${local.name}_updating = true;
					${setter}
					${local.name}_updating = false;
				});
			});
		` );

		local.update.addBlock( deindent`
			if ( !${local.name}_updating && '${parts[0]}' in changed ) {
				${local.name}._set({ ${attribute.name}: ${contextual ? attribute.value : `root.${attribute.value}`} });
			}
		` );
	} else {
		const updateElement = `${local.name}.${attribute.name} = ${contextual ? attribute.value : `root.${attribute.value}`};`;

		generator.uses.addEventListener = true;
		generator.uses.removeEventListener = true;
		local.init.addBlock( deindent`
			var ${local.name}_updating = false;

			function ${handler} () {
				${local.name}_updating = true;
				${setter}
				${local.name}_updating = false;
			}

			addEventListener( ${local.name}, '${eventName}', ${handler} );
		` );

		generator.current.initialUpdate = updateElement;

		local.update.addLine(
			`if ( !${local.name}_updating ) ${updateElement}`
		);

		generator.current.builders.teardown.addLine( deindent`
			removeEventListener( ${local.name}, '${eventName}', ${handler} );
		` );
	}
}

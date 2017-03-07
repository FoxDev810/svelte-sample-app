import deindent from '../../../../../utils/deindent.js';
import isReference from '../../../../../utils/isReference.js';
import flattenReference from '../../../../../utils/flattenReference.js';

export default function createBinding ( generator, node, attribute, current, local ) {
	const parts = attribute.value.split( '.' );

	const deep = parts.length > 1;
	const contextual = parts[0] in current.contexts;

	if ( contextual && !~local.allUsedContexts.indexOf( parts[0] ) ) {
		local.allUsedContexts.push( parts[0] );
	}

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
		const typeAttribute = node.attributes.find( attr => attr.type === 'Attribute' && attr.name === 'type' );
		const type = typeAttribute ? typeAttribute.value[0].data : 'text'; // TODO in validation, should throw if type attribute is not static

		if ( type !== 'checkbox' && type !== 'radio' ) {
			eventName = 'input';
		}
	}

	else if ( node.name === 'textarea' ) {
		eventName = 'input';
	}

	const isMultipleSelect = node.name === 'select' && node.attributes.find( attr => attr.name.toLowerCase() === 'multiple' ); // TODO ensure that this is a static attribute
	let value;

	if ( local.isComponent ) {
		value = 'value';
	} else if ( node.name === 'select' ) {
		if ( isMultipleSelect ) {
			value = `[].map.call( ${local.name}.selectedOptions, function ( option ) { return option.__value; })`;
		} else {
			value = 'selectedOption && selectedOption.__value';
		}
	} else {
		value = `${local.name}.${attribute.name}`;
	}

	if ( contextual ) {
		// find the top-level property that this is a child of
		let fragment = current;
		let prop = parts[0];

		do {
			if ( fragment.expression && fragment.context === prop ) {
				if ( !isReference( fragment.expression ) ) {
					// TODO this should happen in prior validation step
					throw new Error( `${prop} is read-only, it cannot be bound` );
				}

				prop = flattenReference( fragment.expression ).name;
			}
		} while ( fragment = fragment.parent );

		generator.expectedProperties[ prop ] = true;

		const listName = current.listNames[ parts[0] ];
		const indexName = current.indexNames[ parts[0] ];

		const context = local.isComponent ? `_context` : `__svelte`;

		setter = deindent`
			var list = this.${context}.${listName};
			var index = this.${context}.${indexName};
			list[index]${parts.slice( 1 ).map( part => `.${part}` ).join( '' )} = ${value};

			component._set({ ${prop}: component.get( '${prop}' ) });
		`;
	} else {
		if ( deep ) {
			setter = deindent`
				var ${parts[0]} = component.get( '${parts[0]}' );
				${parts[0]}.${parts.slice( 1 ).join( '.' )} = ${value};
				component._set({ ${parts[0]}: ${parts[0]} });
			`;
		} else {
			setter = `component._set({ ${attribute.value}: ${value} });`;
		}

		generator.expectedProperties[ parts[0] ] = true;
	}

	// special case
	if ( node.name === 'select' && !isMultipleSelect ) {
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
		let updateElement;

		if ( node.name === 'select' ) {
			const value = generator.current.getUniqueName( 'value' );
			const i = generator.current.getUniqueName( 'i' );
			const option = generator.current.getUniqueName( 'option' );

			const ifStatement = isMultipleSelect ?
				deindent`
					${option}.selected = ~${value}.indexOf( ${option}.__value );` :
				deindent`
					if ( ${option}.__value === ${value} ) {
						${option}.selected = true;
						break;
					}`;

			updateElement = deindent`
				var ${value} = ${contextual ? attribute.value : `root.${attribute.value}`};
				console.log( 'value', ${value} );
				for ( var ${i} = 0; ${i} < ${local.name}.options.length; ${i} += 1 ) {
					var ${option} = ${local.name}.options[${i}];

					${ifStatement}
				}
			`;
		} else {
			updateElement = `${local.name}.${attribute.name} = ${contextual ? attribute.value : `root.${attribute.value}`};`;
		}

		local.init.addBlock( deindent`
			var ${local.name}_updating = false;

			function ${handler} () {
				${local.name}_updating = true;
				${setter}
				${local.name}_updating = false;
			}

			${generator.helper( 'addEventListener' )}( ${local.name}, '${eventName}', ${handler} );
		` );

		node.initialUpdate = updateElement;

		local.update.addLine( deindent`
			if ( !${local.name}_updating ) {
				${updateElement}
			}
		` );

		generator.current.builders.teardown.addLine( deindent`
			${generator.helper( 'removeEventListener' )}( ${local.name}, '${eventName}', ${handler} );
		` );
	}
}

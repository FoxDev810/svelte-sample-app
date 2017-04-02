import attributeLookup from './lookup.js';
import addElementBinding from './addElementBinding';
import deindent from '../../../../utils/deindent.js';
import flattenReference from '../../../../utils/flattenReference.js';
import getStaticAttributeValue from './binding/getStaticAttributeValue.js';

export default function addElementAttributes ( generator, node, local ) {
	node.attributes.forEach( attribute => {
		const name = attribute.name;

		if ( attribute.type === 'Attribute' ) {
			let metadata = local.namespace ? null : attributeLookup[ name ];
			if ( metadata && metadata.appliesTo && !~metadata.appliesTo.indexOf( node.name ) ) metadata = null;

			let dynamic = false;

			const isIndirectlyBoundValue = name === 'value' && (
				node.name === 'option' || // TODO check it's actually bound
				node.name === 'input' && /^(checkbox|radio)$/.test( getStaticAttributeValue( node, 'type' ) )
			);

			const propertyName = isIndirectlyBoundValue ? '__value' : metadata && metadata.propertyName;

			const isXlink = name.slice( 0, 6 ) === 'xlink:';

			// xlink is a special case... we could maybe extend this to generic
			// namespaced attributes but I'm not sure that's applicable in
			// HTML5?
			const method = isXlink ? 'setXlinkAttribute' : 'setAttribute';

			if ( attribute.value === true ) {
				// attributes without values, e.g. <textarea readonly>
				if ( propertyName ) {
					local.init.addLine(
						`${local.name}.${propertyName} = true;`
					);
				} else {
					local.init.addLine(
						`${generator.helper( method )}( ${local.name}, '${name}', true );`
					);
				}

				// special case – autofocus. has to be handled in a bit of a weird way
				if ( name === 'autofocus' ) {
					generator.current.autofocus = local.name;
				}
			}

			else if ( attribute.value.length === 0 ) {
				if ( propertyName ) {
					local.init.addLine(
						`${local.name}.${propertyName} = '';`
					);
				} else {
					local.init.addLine(
						`${generator.helper( method )}( ${local.name}, '${name}', '' );`
					);
				}
			}

			else if ( attribute.value.length === 1 ) {
				const value = attribute.value[0];

				let result = '';

				if ( value.type === 'Text' ) {
					// static attributes
					result = JSON.stringify( value.data );

					let addAttribute = false;
					if ( name === 'xmlns' ) {
						// special case
						// TODO this attribute must be static – enforce at compile time
						local.namespace = value.data;
						addAttribute = true;
					} else if ( propertyName ) {
						local.init.addLine(
							`${local.name}.${propertyName} = ${result};`
						);
					} else {
						addAttribute = true;
					}

					if ( addAttribute ) {
						local.init.addLine(
							`${generator.helper( method )}( ${local.name}, '${name}', ${result} );`
						);
					}
				}

				else {
					dynamic = true;

					// dynamic – but potentially non-string – attributes
					const { snippet } = generator.contextualise( value.expression );

					const last = `last_${local.name}_${name.replace( /-/g, '_')}`;
					local.init.addLine( `var ${last} = ${snippet};` );

					let updater;
					if ( propertyName ) {
						updater = `${local.name}.${propertyName} = ${last};`;
					} else {
						updater = `${generator.helper( method )}( ${local.name}, '${name}', ${last} );`;
					}

					local.init.addLine( updater );
					local.update.addBlock( deindent`
						if ( ( __tmp = ${snippet} ) !== ${last} ) {
							${last} = __tmp;
							${updater}
						}
					` );
				}
			}

			else {
				dynamic = true;

				const value = ( attribute.value[0].type === 'Text' ? '' : `"" + ` ) + (
					attribute.value.map( chunk => {
						if ( chunk.type === 'Text' ) {
							return JSON.stringify( chunk.data );
						} else {
							const { snippet } = generator.contextualise( chunk.expression );
							return `( ${snippet} )`;
						}
					}).join( ' + ' )
				);

				let updater;
				if (propertyName) {
					updater = `${local.name}.${propertyName} = ${value};`;
				} else {
					updater = `${generator.helper( method )}( ${local.name}, '${name}', ${value} );`;
				}

				local.init.addLine( updater );
				local.update.addLine( updater );
			}

			if ( isIndirectlyBoundValue ) {
				const updateValue = `${local.name}.value = ${local.name}.__value;`;

				local.init.addLine( updateValue );
				if ( dynamic ) local.update.addLine( updateValue );
			}
		}

		else if ( attribute.type === 'EventHandler' ) {
			// TODO verify that it's a valid callee (i.e. built-in or declared method)
			generator.addSourcemapLocations( attribute.expression );

			const flattened = flattenReference( attribute.expression.callee );
			if ( flattened.name !== 'event' && flattened.name !== 'this' ) {
				// allow event.stopPropagation(), this.select() etc
				generator.code.prependRight( attribute.expression.start, `${generator.current.component}.` );
			}

			const usedContexts = [];
			attribute.expression.arguments.forEach( arg => {
				const { contexts } = generator.contextualise( arg, true );

				contexts.forEach( context => {
					if ( !~usedContexts.indexOf( context ) ) usedContexts.push( context );
					if ( !~local.allUsedContexts.indexOf( context ) ) local.allUsedContexts.push( context );
				});
			});

			// TODO hoist event handlers? can do `this.__component.method(...)`
			const declarations = usedContexts.map( name => {
				if ( name === 'root' ) return 'var root = this.__svelte.root;';

				const listName = generator.current.listNames.get( name );
				const indexName = generator.current.indexNames.get( name );

				return `var ${listName} = this.__svelte.${listName}, ${indexName} = this.__svelte.${indexName}, ${name} = ${listName}[${indexName}]`;
			});

			const handlerName = generator.current.getUniqueName( `${name}Handler` );
			const handlerBody = ( declarations.length ? declarations.join( '\n' ) + '\n\n' : '' ) + `[✂${attribute.expression.start}-${attribute.expression.end}✂];`;

			if ( generator.events.has( name ) ) {
				local.init.addBlock( deindent`
					var ${handlerName} = ${generator.alias( 'template' )}.events.${name}.call( ${generator.current.component}, ${local.name}, function ( event ) {
						${handlerBody}
					}.bind( ${local.name} ) );
				` );

				generator.current.builders.teardown.addLine( deindent`
					${handlerName}.teardown();
				` );
			} else {
				local.init.addBlock( deindent`
					function ${handlerName} ( event ) {
						${handlerBody}
					}

					${generator.helper( 'addEventListener' )}( ${local.name}, '${name}', ${handlerName} );
				` );

				generator.current.builders.teardown.addLine( deindent`
					${generator.helper( 'removeEventListener' )}( ${local.name}, '${name}', ${handlerName} );
				` );
			}
		}

		else if ( attribute.type === 'Binding' ) {
			addElementBinding( generator, node, attribute, generator.current, local );
		}

		else if ( attribute.type === 'Ref' ) {
			generator.usesRefs = true;

			local.init.addLine(
				`${generator.current.component}.refs.${name} = ${local.name};`
			);

			generator.current.builders.teardown.addLine( deindent`
				if ( ${generator.current.component}.refs.${name} === ${local.name} ) ${generator.current.component}.refs.${name} = null;
			` );
		}

		else {
			throw new Error( `Not implemented: ${attribute.type}` );
		}
	});
}

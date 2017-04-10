import flattenReference from '../../../../../utils/flattenReference.js';
import deindent from '../../../../../utils/deindent.js';
import CodeBuilder from '../../../../../utils/CodeBuilder.js';

const associatedEvents = {
	innerWidth: 'resize',
	innerHeight: 'resize',
	outerWidth: 'resize',
	outerHeight: 'resize',

	scrollX: 'scroll',
	scrollY: 'scroll'
};

export default function visitWindow ( generator, block, node ) {
	const events = {};
	const bindings = {};

	node.attributes.forEach( attribute => {
		if ( attribute.type === 'EventHandler' ) {
			// TODO verify that it's a valid callee (i.e. built-in or declared method)
			generator.addSourcemapLocations( attribute.expression );

			const flattened = flattenReference( attribute.expression.callee );
			if ( flattened.name !== 'event' && flattened.name !== 'this' ) {
				// allow event.stopPropagation(), this.select() etc
				generator.code.prependRight( attribute.expression.start, 'component.' );
			}

			const handlerName = block.getUniqueName( `onwindow${attribute.name}` );

			block.builders.create.addBlock( deindent`
				var ${handlerName} = function ( event ) {
					[✂${attribute.expression.start}-${attribute.expression.end}✂];
				};
				window.addEventListener( '${attribute.name}', ${handlerName} );
			` );

			block.builders.destroy.addBlock( deindent`
				window.removeEventListener( '${attribute.name}', ${handlerName} );
			` );
		}

		if ( attribute.type === 'Binding' ) {
			const associatedEvent = associatedEvents[ attribute.name ];

			if ( !associatedEvent ) {
				throw new Error( `Cannot bind to ${attribute.name} on <:Window>` );
			}

			if ( attribute.value.type !== 'Identifier' ) {
				const { parts, keypath } = flattenReference( attribute.value );
				throw new Error( `Bindings on <:Window/> must be to top-level properties, e.g. '${parts.pop()}' rather than '${keypath}'` );
			}

			bindings[ attribute.name ] = attribute.value.name;

			if ( !events[ associatedEvent ] ) events[ associatedEvent ] = [];
			events[ associatedEvent ].push( `${attribute.value.name}: this.${attribute.name}` );

			// add initial value
			generator.builders.metaBindings.addLine(
				`this._state.${attribute.value.name} = window.${attribute.name};`
			);
		}
	});

	const lock = block.getUniqueName( `window_updating` );

	Object.keys( events ).forEach( event => {
		const handlerName = block.getUniqueName( `onwindow${event}` );
		const props = events[ event ].join( ',\n' );

		const handlerBody = new CodeBuilder();
		if ( event === 'scroll' ) { // TODO other bidirectional bindings...
			block.builders.create.addLine( `var ${lock} = false;` );
			handlerBody.addLine( `${lock} = true;` );
		}

		handlerBody.addBlock( deindent`
			component.set({
				${props}
			});
		` );

		if ( event === 'scroll' ) {
			handlerBody.addLine( `${lock} = false;` );
		}

		block.builders.create.addBlock( deindent`
			var ${handlerName} = function ( event ) {
				${handlerBody}
			};
			window.addEventListener( '${event}', ${handlerName} );
		` );

		block.builders.destroy.addBlock( deindent`
			window.removeEventListener( '${event}', ${handlerName} );
		` );
	});

	// special case... might need to abstract this out if we add more special cases
	if ( bindings.scrollX && bindings.scrollY ) {
		const observerCallback = block.getUniqueName( `scrollobserver` );

		block.builders.create.addBlock( deindent`
			function ${observerCallback} () {
				if ( ${lock} ) return;
				var x = ${bindings.scrollX ? `component.get( '${bindings.scrollX}' )` : `window.scrollX`};
				var y = ${bindings.scrollY ? `component.get( '${bindings.scrollY}' )` : `window.scrollY`};
				window.scrollTo( x, y );
			};
		` );

		if ( bindings.scrollX ) block.builders.create.addLine( `component.observe( '${bindings.scrollX}', ${observerCallback} );` );
		if ( bindings.scrollY ) block.builders.create.addLine( `component.observe( '${bindings.scrollY}', ${observerCallback} );` );
	} else if ( bindings.scrollX || bindings.scrollY ) {
		const isX = !!bindings.scrollX;

		block.builders.create.addBlock( deindent`
			component.observe( '${bindings.scrollX || bindings.scrollY}', function ( ${isX ? 'x' : 'y'} ) {
				if ( ${lock} ) return;
				window.scrollTo( ${isX ? 'x, window.scrollY' : 'window.scrollX, y' } );
			});
		` );
	}
}
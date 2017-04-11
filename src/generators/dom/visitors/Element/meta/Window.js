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

const readonly = new Set([
	'innerWidth',
	'innerHeight',
	'outerWidth',
	'outerHeight',
	'online'
]);

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
			if ( attribute.value.type !== 'Identifier' ) {
				const { parts, keypath } = flattenReference( attribute.value );
				throw new Error( `Bindings on <:Window/> must be to top-level properties, e.g. '${parts.pop()}' rather than '${keypath}'` );
			}

			// in dev mode, throw if read-only values are written to
			if ( readonly.has( attribute.name ) ) {
				generator.readonly.add( attribute.value.name );
			}

			bindings[ attribute.name ] = attribute.value.name;

			// bind:online is a special case, we need to listen for two separate events
			if ( attribute.name === 'online' ) return;

			const associatedEvent = associatedEvents[ attribute.name ];

			if ( !associatedEvent ) {
				throw new Error( `Cannot bind to ${attribute.name} on <:Window>` );
			}

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

		if ( generator.options.dev ) handlerBody.addLine( `component._updatingReadonlyProperty = true;` );

		handlerBody.addBlock( deindent`
			component.set({
				${props}
			});
		` );

		if ( generator.options.dev ) handlerBody.addLine( `component._updatingReadonlyProperty = false;` );

		if ( event === 'scroll' ) {
			handlerBody.addLine( `${lock} = false;` );
		}

		block.builders.create.addBlock( deindent`
			function ${handlerName} ( event ) {
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

	// another special case. (I'm starting to think these are all special cases.)
	if ( bindings.online ) {
		const handlerName = block.getUniqueName( `onlinestatuschanged` );
		block.builders.create.addBlock( deindent`
			function ${handlerName} ( event ) {
				component.set({ ${bindings.online}: navigator.onLine });
			};
			window.addEventListener( 'online', ${handlerName} );
			window.addEventListener( 'offline', ${handlerName} );
		` );

		// add initial value
		generator.builders.metaBindings.addLine(
			`this._state.${bindings.online} = navigator.onLine;`
		);

		block.builders.destroy.addBlock( deindent`
			window.removeEventListener( 'online', ${handlerName} );
			window.removeEventListener( 'offline', ${handlerName} );
		` );
	}
}
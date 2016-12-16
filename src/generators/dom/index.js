import deindent from '../../utils/deindent.js';
import getBuilders from './utils/getBuilders.js';
import CodeBuilder from '../../utils/CodeBuilder.js';
import namespaces from '../../utils/namespaces.js';
import processCss from '../shared/css/process.js';
import visitors from './visitors/index.js';
import Generator from '../Generator.js';

export default function dom ( parsed, source, options, names ) {
	const format = options.format || 'es';

	const generator = new Generator( parsed, source, names, visitors );

	const { computations, templateProperties } = generator.parseJs();

	const renderers = [];
	function addRenderer ( fragment ) {
		if ( fragment.autofocus ) {
			fragment.builders.init.addLine( `${fragment.autofocus}.focus();` );
		}

		// minor hack – we need to ensure that any {{{triples}}} are detached
		// first, so we append normal detach statements to detachRaw
		fragment.builders.detachRaw.addBlock( fragment.builders.detach );

		if ( !fragment.builders.detachRaw.isEmpty() ) {
			fragment.builders.teardown.addBlock( deindent`
				if ( detach ) {
					${fragment.builders.detachRaw}
				}
			` );
		}

		renderers.push( deindent`
			function ${fragment.name} ( ${fragment.params}, component ) {
				${fragment.builders.init}

				return {
					mount: function ( target, anchor ) {
						${fragment.builders.mount}
					},

					update: function ( changed, ${fragment.params} ) {
						${fragment.builders.update}
					},

					teardown: function ( detach ) {
						${fragment.builders.teardown}
					}
				};
			}
		` );
	}

	generator.on( 'addRenderer', addRenderer );

	generator.on( 'addElement', ({ name, renderStatement, needsIdentifier }) => {
		const isToplevel = generator.current.localElementDepth === 0;
		if ( needsIdentifier || isToplevel ) {
			generator.current.builders.init.addLine(
				`var ${name} = ${renderStatement};`
			);

			generator.fire( 'createMountStatement', name );
		} else {
			generator.current.builders.init.addLine(
				`${generator.current.target}.appendChild( ${renderStatement} );`
			);
		}

		if ( isToplevel ) {
			generator.current.builders.detach.addLine(
				`${name}.parentNode.removeChild( ${name} );`
			);
		}
	});

	generator.on( 'createAnchor', ({ name, description = '' }) => {
		const renderStatement = `document.createComment( ${JSON.stringify( description )} )`;

		generator.fire( 'addElement', {
			name,
			renderStatement,
			needsIdentifier: true
		});
	});

	generator.on( 'createMountStatement', name => {
		if ( generator.current.target === 'target' ) {
			generator.current.builders.mount.addLine(
				`target.insertBefore( ${name}, anchor );`
			);
		} else {
			generator.current.builders.init.addLine(
				`${generator.current.target}.appendChild( ${name} );` );
		}
	});

	generator.on( 'generateBlock', ({ node, name }) => {
		generator.push({
			name,
			target: 'target',
			localElementDepth: 0,
			builders: getBuilders(),
			getUniqueName: generator.getUniqueNameMaker()
		});

		// walk the children here
		node.children.forEach( node => generator.visit( node ) );
		generator.fire( 'addRenderer', generator.current );
		generator.pop();

		// unset the children, to avoid them being visited again
		node.children = [];
	});

	let namespace = null;
	if ( templateProperties.namespace ) {
		const ns = templateProperties.namespace.value;
		namespace = namespaces[ ns ] || ns;

		// TODO remove the namespace property from the generated code, it's unused past this point
	}

	generator.push({
		name: 'renderMainFragment',
		namespace,
		target: 'target',
		localElementDepth: 0,

		contexts: {},
		indexes: {},

		params: 'root',
		indexNames: {},
		listNames: {},

		builders: getBuilders(),
		getUniqueName: generator.getUniqueNameMaker()
	});

	parsed.html.children.forEach( node => generator.visit( node ) );

	addRenderer( generator.pop() );

	const builders = {
		main: new CodeBuilder(),
		init: new CodeBuilder(),
		set: new CodeBuilder()
	};

	builders.set.addLine( 'var oldState = state;' );
	builders.set.addLine( 'state = Object.assign( {}, oldState, newState );' );

	if ( computations.length ) {
		const builder = new CodeBuilder();

		computations.forEach( ({ key, deps }) => {
			builder.addBlock( deindent`
				if ( ${deps.map( dep => `( '${dep}' in newState && typeof state.${dep} === 'object' || state.${dep} !== oldState.${dep} )` ).join( ' || ' )} ) {
					state.${key} = newState.${key} = template.computed.${key}( ${deps.map( dep => `state.${dep}` ).join( ', ' )} );
				}
			` );
		});

		builders.main.addBlock( deindent`
			function applyComputations ( state, newState, oldState ) {
				${builder}
			}
		` );

		builders.set.addLine( `applyComputations( state, newState, oldState )` );
	}

	builders.set.addBlock( deindent`
		dispatchObservers( observers.immediate, newState, oldState );
		if ( mainFragment ) mainFragment.update( newState, state );
		dispatchObservers( observers.deferred, newState, oldState );
	` );

	if ( parsed.js ) {
		builders.main.addBlock( `[✂${parsed.js.content.start}-${parsed.js.content.end}✂]` );
	}

	if ( parsed.css && options.css !== false ) {
		builders.main.addBlock( deindent`
			let addedCss = false;
			function addCss () {
				var style = document.createElement( 'style' );
				style.textContent = ${JSON.stringify( processCss( parsed ) )};
				document.head.appendChild( style );

				addedCss = true;
			}
		` );
	}

	let i = renderers.length;
	while ( i-- ) builders.main.addBlock( renderers[i] );

	const constructorName = options.name || 'SvelteComponent';

	if ( parsed.css && options.css !== false ) {
		builders.init.addLine( `if ( !addedCss ) addCss();` );
	}

	if ( generator.hasComponents ) {
		builders.init.addLine( `this.__renderHooks = [];` );
	}

	if ( generator.hasComplexBindings ) {
		builders.init.addBlock( deindent`
			this.__bindings = [];
			var mainFragment = renderMainFragment( state, this );
			if ( options.target ) this._mount( options.target );
			while ( this.__bindings.length ) this.__bindings.pop()();
		` );

		builders.set.addLine( `while ( this.__bindings.length ) this.__bindings.pop()();` );
	} else {
		builders.init.addBlock( deindent`
			var mainFragment = renderMainFragment( state, this );
			if ( options.target ) this._mount( options.target );
		` );
	}

	if ( generator.hasComponents ) {
		const statement = deindent`
			while ( this.__renderHooks.length ) {
				var hook = this.__renderHooks.pop();
				hook.fn.call( hook.context );
			}
		`;

		builders.init.addBlock( statement );
		builders.set.addBlock( statement );
	}

	if ( templateProperties.onrender ) {
		builders.init.addBlock( deindent`
			if ( options.root ) {
				options.root.__renderHooks.push({ fn: template.onrender, context: this });
			} else {
				template.onrender.call( this );
			}
		` );
	}

	const initialState = templateProperties.data ? `Object.assign( template.data(), options.data )` : `options.data || {}`;

	builders.main.addBlock( deindent`
		function ${constructorName} ( options ) {
			options = options || {};

			var component = this;${generator.usesRefs ? `\nthis.refs = {}` : ``}
			var state = ${initialState};${templateProperties.computed ? `\napplyComputations( state, state, {} );` : ``}

			var observers = {
				immediate: Object.create( null ),
				deferred: Object.create( null )
			};

			var callbacks = Object.create( null );

			function dispatchObservers ( group, newState, oldState ) {
				for ( var key in group ) {
					if ( !( key in newState ) ) continue;

					var newValue = newState[ key ];
					var oldValue = oldState[ key ];

					if ( newValue === oldValue && typeof newValue !== 'object' ) continue;

					var callbacks = group[ key ];
					if ( !callbacks ) continue;

					for ( var i = 0; i < callbacks.length; i += 1 ) {
						var callback = callbacks[i];
						if ( callback.__calling ) continue;

						callback.__calling = true;
						callback.call( component, newValue, oldValue );
						callback.__calling = false;
					}
				}
			}

			this.fire = function fire ( eventName, data ) {
				var handlers = eventName in callbacks && callbacks[ eventName ].slice();
				if ( !handlers ) return;

				for ( var i = 0; i < handlers.length; i += 1 ) {
					handlers[i].call( this, data );
				}
			};

			this.get = function get ( key ) {
				return key ? state[ key ] : state;
			};

			this.set = function set ( newState ) {
				${builders.set}
			};

			this._mount = function mount ( target, anchor ) {
				mainFragment.mount( target, anchor );
			}

			this.observe = function ( key, callback, options ) {
				var group = ( options && options.defer ) ? observers.deferred : observers.immediate;

				( group[ key ] || ( group[ key ] = [] ) ).push( callback );

				if ( !options || options.init !== false ) {
					callback.__calling = true;
					callback.call( component, state[ key ] );
					callback.__calling = false;
				}

				return {
					cancel: function () {
						var index = group[ key ].indexOf( callback );
						if ( ~index ) group[ key ].splice( index, 1 );
					}
				};
			};

			this.on = function on ( eventName, handler ) {
				var handlers = callbacks[ eventName ] || ( callbacks[ eventName ] = [] );
				handlers.push( handler );

				return {
					cancel: function () {
						var index = handlers.indexOf( handler );
						if ( ~index ) handlers.splice( index, 1 );
					}
				};
			};

			this.teardown = function teardown ( detach ) {
				this.fire( 'teardown' );${templateProperties.onteardown ? `\ntemplate.onteardown.call( this );` : ``}

				mainFragment.teardown( detach !== false );
				mainFragment = null;

				state = {};
			};

			this.root = options.root;
			this.yield = options.yield;

			${builders.init}
		}
	` );

	if ( templateProperties.methods ) {
		builders.main.addBlock( `${constructorName}.prototype = template.methods;` );
	}

	return generator.generate( builders.main.toString(), options, { constructorName, format } );
}

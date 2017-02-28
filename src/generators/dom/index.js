import deindent from '../../utils/deindent.js';
import getBuilders from './utils/getBuilders.js';
import CodeBuilder from '../../utils/CodeBuilder.js';
import namespaces from '../../utils/namespaces.js';
import processCss from '../shared/processCss.js';
import visitors from './visitors/index.js';
import Generator from '../Generator.js';
import * as shared from '../../shared/index.js';

class DomGenerator extends Generator {
	constructor ( parsed, source, names, visitors ) {
		super( parsed, source, names, visitors );
		this.renderers = [];
		this.uses = {};

		// allow compiler to deconflict user's `import { get } from 'whatever'` and
		// Svelte's builtin `import { get, ... } from 'svelte/shared.js'`;
		this.importedNames = {};
		this.aliases = {};
	}

	addElement ( name, renderStatement, needsIdentifier = false ) {
		const isToplevel = this.current.localElementDepth === 0;
		if ( needsIdentifier || isToplevel ) {
			this.current.builders.init.addLine(
				`var ${name} = ${renderStatement};`
			);

			this.createMountStatement( name );
		} else {
			this.current.builders.init.addLine( `${this.helper( 'appendNode' )}( ${renderStatement}, ${this.current.target} );` );
		}

		if ( isToplevel ) {
			this.current.builders.detach.addLine( `${this.helper( 'detachNode' )}( ${name} );` );
		}
	}

	addRenderer ( fragment ) {
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

		const properties = new CodeBuilder();

		if ( fragment.key ) properties.addBlock( `key: key,` );

		if ( fragment.builders.mount.isEmpty() ) {
			properties.addBlock( `mount: ${this.helper( 'noop' )},` );
		} else {
			properties.addBlock( deindent`
				mount: function ( target, anchor ) {
					${fragment.builders.mount}
				},
			` );
		}

		if ( fragment.builders.update.isEmpty() ) {
			properties.addBlock( `update: ${this.helper( 'noop' )},` );
		} else {
			properties.addBlock( deindent`
				update: function ( changed, ${fragment.params} ) {
					var __tmp;

					${fragment.builders.update}
				},
			` );
		}

		if ( fragment.builders.teardown.isEmpty() ) {
			properties.addBlock( `teardown: ${this.helper( 'noop' )},` );
		} else {
			properties.addBlock( deindent`
				teardown: function ( detach ) {
					${fragment.builders.teardown}
				}
			` );
		}

		this.renderers.push( deindent`
			function ${fragment.name} ( ${fragment.params}, component${fragment.key ? `, key` : ''} ) {
				${fragment.builders.init}

				return {
					${properties}
				};
			}
		` );
	}

	createAnchor ( name ) {
		const renderStatement = `${this.helper( 'createComment' )}()`;
		this.addElement( name, renderStatement, true );
	}

	createMountStatement ( name ) {
		if ( this.current.target === 'target' ) {
			this.current.builders.mount.addLine( `${this.helper( 'insertNode' )}( ${name}, target, anchor );` );
		} else {
			this.current.builders.init.addLine( `${this.helper( 'appendNode' )}( ${name}, ${this.current.target} );` );
		}
	}

	generateBlock ( node, name ) {
		this.push({
			name,
			target: 'target',
			localElementDepth: 0,
			builders: getBuilders(),
			getUniqueName: this.getUniqueNameMaker()
		});

		// walk the children here
		node.children.forEach( node => this.visit( node ) );
		this.addRenderer( this.current );
		this.pop();

		// unset the children, to avoid them being visited again
		node.children = [];
	}

	helper ( name ) {
		this.uses[ name ] = true;

		if ( !( name in this.aliases ) ) {
			let alias = name;
			let i = 1;
			while ( alias in this.importedNames ) {
				alias = `${name}$${i++}`;
			}

			this.aliases[ name ] = alias;
		}

		return this.aliases[ name ];
	}
}

export default function dom ( parsed, source, options, names ) {
	const format = options.format || 'es';
	const name = options.name || 'SvelteComponent';

	const generator = new DomGenerator( parsed, source, names, visitors );

	const { computations, templateProperties } = generator.parseJs();

	generator.imports.forEach( node => {
		node.specifiers.forEach( specifier => {
			generator.importedNames[ specifier.local.name ] = true;
		});
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
		key: null,

		contexts: {},
		indexes: {},

		params: 'root',
		indexNames: {},
		listNames: {},

		builders: getBuilders(),
		getUniqueName: generator.getUniqueNameMaker()
	});

	parsed.html.children.forEach( node => generator.visit( node ) );

	generator.addRenderer( generator.pop() );

	const builders = {
		main: new CodeBuilder(),
		init: new CodeBuilder(),
		_set: new CodeBuilder()
	};

	builders._set.addLine( 'var oldState = this._state;' );
	builders._set.addLine( 'this._state = Object.assign( {}, oldState, newState );' );

	if ( computations.length ) {
		const builder = new CodeBuilder();

		computations.forEach( ({ key, deps }) => {
			builder.addBlock( deindent`
				if ( isInitial || ${deps.map( dep => `( '${dep}' in newState && typeof state.${dep} === 'object' || state.${dep} !== oldState.${dep} )` ).join( ' || ' )} ) {
					state.${key} = newState.${key} = template.computed.${key}( ${deps.map( dep => `state.${dep}` ).join( ', ' )} );
				}
			` );
		});

		builders.main.addBlock( deindent`
			function applyComputations ( state, newState, oldState, isInitial ) {
				${builder}
			}
		` );

		builders._set.addLine( `applyComputations( this._state, newState, oldState, false )` );
	}

	// TODO is the `if` necessary?
	builders._set.addBlock( deindent`
		dispatchObservers( this, this._observers.pre, newState, oldState );
		if ( this._fragment ) this._fragment.update( newState, this._state );
		dispatchObservers( this, this._observers.post, newState, oldState );
	` );

	if ( parsed.js ) {
		builders.main.addBlock( `[✂${parsed.js.content.start}-${parsed.js.content.end}✂]` );
	}

	if ( parsed.css && options.css !== false ) {
		builders.main.addBlock( deindent`
			let addedCss = false;
			function addCss () {
				var style = ${generator.helper( 'createElement' )}( 'style' );
				style.textContent = ${JSON.stringify( processCss( parsed, generator.code ) )};
				${generator.helper( 'appendNode' )}( style, document.head );

				addedCss = true;
			}
		` );
	}

	let i = generator.renderers.length;
	while ( i-- ) builders.main.addBlock( generator.renderers[i] );

	builders.init.addLine( `this._torndown = false;` );

	if ( parsed.css && options.css !== false ) {
		builders.init.addLine( `if ( !addedCss ) addCss();` );
	}

	if ( generator.hasComponents ) {
		builders.init.addLine( `this._renderHooks = [];` );
	}

	if ( generator.hasComplexBindings ) {
		builders.init.addBlock( deindent`
			this._bindings = [];
			this._fragment = renderMainFragment( this._state, this );
			if ( options.target ) this._fragment.mount( options.target, null );
			while ( this._bindings.length ) this._bindings.pop()();
		` );

		builders._set.addLine( `while ( this._bindings.length ) this._bindings.pop()();` );
	} else {
		builders.init.addBlock( deindent`
			this._fragment = renderMainFragment( this._state, this );
			if ( options.target ) this._fragment.mount( options.target, null );
		` );
	}

	if ( generator.hasComponents ) {
		const statement = `this._flush();`;

		builders.init.addBlock( statement );
		builders._set.addBlock( statement );
	}

	if ( templateProperties.onrender ) {
		builders.init.addBlock( deindent`
			if ( options._root ) {
				options._root._renderHooks.push({ fn: template.onrender, context: this });
			} else {
				template.onrender.call( this );
			}
		` );
	}

	const initialState = templateProperties.data ? `Object.assign( template.data(), options.data )` : `options.data || {}`;

	builders.main.addBlock( deindent`
		function ${name} ( options ) {
			options = options || {};
			${generator.usesRefs ? `\nthis.refs = {}` : ``}
			this._state = ${initialState};${templateProperties.computed ? `\napplyComputations( this._state, this._state, {}, true );` : ``}

			this._observers = {
				pre: Object.create( null ),
				post: Object.create( null )
			};

			this._handlers = Object.create( null );

			this._root = options._root;
			this._yield = options._yield;

			${builders.init}
		}
	` );

	if ( templateProperties.methods ) {
		builders.main.addBlock( `${name}.prototype = template.methods;` );
	}

	const sharedPath = options.shared === true ? 'svelte/shared.js' : options.shared;

	builders.main.addBlock( sharedPath ?
		deindent`
			${name}.prototype.get = ${generator.helper( 'get' )};
			${name}.prototype.fire = ${generator.helper( 'fire' )};
			${name}.prototype.observe = ${generator.helper( 'observe' )};
			${name}.prototype.on = ${generator.helper( 'on' )};
			${name}.prototype.set = ${generator.helper( 'set' )};
			${name}.prototype._flush = ${generator.helper( '_flush' )};
		` :
		deindent`
			${name}.prototype.get = ${shared.get};

			${name}.prototype.fire = ${shared.fire};

			${name}.prototype.observe = ${shared.observe};

			${name}.prototype.on = ${shared.on};

			${name}.prototype.set = ${shared.set};

			${name}.prototype._flush = ${shared._flush};
		` );

	builders.main.addBlock( deindent`
		${name}.prototype._set = function _set ( newState ) {
			${builders._set}
		};

		${name}.prototype.teardown = function teardown ( detach ) {
			this.fire( 'teardown' );${templateProperties.onteardown ? `\ntemplate.onteardown.call( this );` : ``}

			this._fragment.teardown( detach !== false );
			this._fragment = null;

			this._state = {};
			this._torndown = true;
		};
	` );

	if ( sharedPath ) {
		if ( format !== 'es' ) {
			throw new Error( `Components with shared helpers must be compiled to ES2015 modules (format: 'es')` );
		}

		const names = [ 'get', 'fire', 'observe', 'on', 'set', '_flush', 'dispatchObservers' ].concat( Object.keys( generator.uses ) )
			.map( name => name in generator.aliases && name !== generator.aliases[ name ] ? `${name} as ${generator.aliases[ name ]}` : name );

		builders.main.addLineAtStart(
			`import { ${names.join( ', ' )} } from ${JSON.stringify( sharedPath )}`
		);
	} else {
		builders.main.addBlock( shared.dispatchObservers.toString() );

		Object.keys( generator.uses ).forEach( key => {
			const fn = shared[ key ]; // eslint-disable-line import/namespace
			builders.main.addBlock( fn.toString() );
		});
	}

	return generator.generate( builders.main.toString(), options, { name, format } );
}

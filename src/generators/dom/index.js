import deindent from '../../utils/deindent.js';
import getBuilders from './utils/getBuilders.js';
import CodeBuilder from '../../utils/CodeBuilder.js';
import visit from './visit.js';
import Generator from '../Generator.js';
import Fragment from './Fragment.js';
import * as shared from '../../shared/index.js';

class DomGenerator extends Generator {
	constructor ( parsed, source, name, options ) {
		super( parsed, source, name, options );
		this.renderers = [];
		this.uses = new Set();

		// initial values for e.g. window.innerWidth, if there's a <:Window> meta tag
		this.builders = {
			metaBindings: new CodeBuilder()
		};
	}

	addRenderer ( fragment ) {
		if ( fragment.autofocus ) {
			fragment.builders.create.addLine( `${fragment.autofocus}.focus();` );
		}

		// minor hack – we need to ensure that any {{{triples}}} are detached
		// first, so we append normal detach statements to detachRaw
		fragment.builders.detachRaw.addBlock( fragment.builders.detach );

		if ( !fragment.builders.detachRaw.isEmpty() ) {
			fragment.builders.destroy.addBlock( deindent`
				if ( detach ) {
					${fragment.builders.detachRaw}
				}
			` );
		}

		const properties = new CodeBuilder();

		let localKey;
		if ( fragment.key ) {
			localKey = fragment.getUniqueName( 'key' );
			properties.addBlock( `key: ${localKey},` );
		}

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
				update: function ( changed, ${fragment.params.join( ', ' )} ) {
					${fragment.tmp ? `var ${fragment.tmp};` : ''}

					${fragment.builders.update}
				},
			` );
		}

		if ( fragment.builders.destroy.isEmpty() ) {
			properties.addBlock( `destroy: ${this.helper( 'noop' )},` );
		} else {
			properties.addBlock( deindent`
				destroy: function ( detach ) {
					${fragment.builders.destroy}
				}
			` );
		}

		this.renderers.push( deindent`
			function ${fragment.name} ( ${fragment.params.join( ', ' )}, ${fragment.component}${fragment.key ? `, ${localKey}` : ''} ) {
				${fragment.builders.create}

				return {
					${properties}
				};
			}
		` );
	}

	generateBlock ( node, name, type ) {
		const childFragment = this.current.child({
			type,
			name,
			target: 'target',
			localElementDepth: 0,
			builders: getBuilders(),
			getUniqueName: this.getUniqueNameMaker( this.current.params )
		});

		this.push( childFragment );

		// walk the children here
		node.children.forEach( node => visit( node, this ) );
		this.addRenderer( this.current );
		this.pop();

		// unset the children, to avoid them being visited again
		node.children = [];
	}

	helper ( name ) {
		if ( this.options.dev && `${name}Dev` in shared ) {
			name = `${name}Dev`;
		}

		this.uses.add( name );

		return this.alias( name );
	}
}

export default function dom ( parsed, source, options ) {
	const format = options.format || 'es';
	const name = options.name || 'SvelteComponent';

	const generator = new DomGenerator( parsed, source, name, options );

	const { computations, hasJs, templateProperties, namespace } = generator.parseJs();

	const getUniqueName = generator.getUniqueNameMaker( [ 'root' ] );
	const component = getUniqueName( 'component' );

	const mainFragment = new Fragment({
		type: 'block',
		generator,
		name: generator.alias( 'create_main_fragment' ),
		namespace,
		target: 'target',
		localElementDepth: 0,
		key: null,

		component,

		contexts: new Map(),
		indexes: new Map(),

		params: [ 'root' ],
		indexNames: new Map(),
		listNames: new Map(),

		builders: getBuilders(),
		getUniqueName
	});
	generator.push( mainFragment );

	parsed.html.children.forEach( node => {
		visit( generator, mainFragment, node );
	});

	generator.addRenderer( mainFragment );

	const builders = {
		main: new CodeBuilder(),
		init: new CodeBuilder(),
		_set: new CodeBuilder()
	};

	if ( options.dev ) {
		builders._set.addBlock ( deindent`
			if ( typeof newState !== 'object' ) {
				throw new Error( 'Component .set was called without an object of data key-values to update.' );
			}
		`);
	}

	builders._set.addLine( 'var oldState = this._state;' );
	builders._set.addLine( `this._state = ${generator.helper( 'assign' )}( {}, oldState, newState );` );

	if ( computations.length ) {
		const builder = new CodeBuilder();
		const differs = generator.helper( 'differs' );

		computations.forEach( ({ key, deps }) => {
			builder.addBlock( deindent`
				if ( isInitial || ${deps.map( dep => `( '${dep}' in newState && ${differs}( state.${dep}, oldState.${dep} ) )` ).join( ' || ' )} ) {
					state.${key} = newState.${key} = ${generator.alias( 'template' )}.computed.${key}( ${deps.map( dep => `state.${dep}` ).join( ', ' )} );
				}
			` );
		});

		builders.main.addBlock( deindent`
			function ${generator.alias( 'recompute' )} ( state, newState, oldState, isInitial ) {
				${builder}
			}
		` );

		builders._set.addLine( `${generator.alias( 'recompute' )}( this._state, newState, oldState, false )` );
	}

	// TODO is the `if` necessary?
	builders._set.addBlock( deindent`
		${generator.helper( 'dispatchObservers' )}( this, this._observers.pre, newState, oldState );
		if ( this._fragment ) this._fragment.update( newState, this._state );
		${generator.helper( 'dispatchObservers' )}( this, this._observers.post, newState, oldState );
	` );

	if ( hasJs ) {
		builders.main.addBlock( `[✂${parsed.js.content.start}-${parsed.js.content.end}✂]` );
	}

	if ( generator.css && options.css !== false ) {
		builders.main.addBlock( deindent`
			var ${generator.alias( 'added_css' )} = false;
			function ${generator.alias( 'add_css' )} () {
				var style = ${generator.helper( 'createElement' )}( 'style' );
				style.textContent = ${JSON.stringify( generator.css )};
				${generator.helper( 'appendNode' )}( style, document.head );

				${generator.alias( 'added_css' )} = true;
			}
		` );
	}

	let i = generator.renderers.length;
	while ( i-- ) builders.main.addBlock( generator.renderers[i] );

	builders.init.addLine( `this._torndown = false;` );

	if ( parsed.css && options.css !== false ) {
		builders.init.addLine( `if ( !${generator.alias( 'added_css' )} ) ${generator.alias( 'add_css' )}();` );
	}

	if ( generator.hasComponents ) {
		builders.init.addLine( `this._renderHooks = [];` );
	}

	if ( generator.hasComplexBindings ) {
		builders.init.addBlock( deindent`
			this._bindings = [];
			this._fragment = ${generator.alias( 'create_main_fragment' )}( this._state, this );
			if ( options.target ) this._fragment.mount( options.target, null );
			while ( this._bindings.length ) this._bindings.pop()();
		` );

		builders._set.addLine( `while ( this._bindings.length ) this._bindings.pop()();` );
	} else {
		builders.init.addBlock( deindent`
			this._fragment = ${generator.alias( 'create_main_fragment' )}( this._state, this );
			if ( options.target ) this._fragment.mount( options.target, null );
		` );
	}

	if ( generator.hasComponents ) {
		const statement = `this._flush();`;

		builders.init.addBlock( statement );
		builders._set.addBlock( statement );
	}

	if ( templateProperties.oncreate ) {
		builders.init.addBlock( deindent`
			if ( options._root ) {
				options._root._renderHooks.push({ fn: ${generator.alias( 'template' )}.oncreate, context: this });
			} else {
				${generator.alias( 'template' )}.oncreate.call( this );
			}
		` );
	}

	const constructorBlock = new CodeBuilder();

	constructorBlock.addLine( `options = options || {};` );
	if ( generator.usesRefs ) constructorBlock.addLine( `this.refs = {};` );

	constructorBlock.addLine(
		`this._state = ${templateProperties.data ? `${generator.helper( 'assign' )}( ${generator.alias( 'template' )}.data(), options.data )` : `options.data || {}`};`
	);

	if ( !generator.builders.metaBindings.isEmpty() ) {
		constructorBlock.addBlock( generator.builders.metaBindings );
	}

	if ( templateProperties.computed ) {
		constructorBlock.addLine(
			`${generator.alias( 'recompute' )}( this._state, this._state, {}, true );`
		);
	}

	if ( options.dev ) {
		generator.expectedProperties.forEach( prop => {
			constructorBlock.addLine(
				`if ( !( '${prop}' in this._state ) ) throw new Error( "Component was created without expected data property '${prop}'" );`
			);
		});

		constructorBlock.addBlock(
			`if ( !options.target && !options._root ) throw new Error( "'target' is a required option" );`
		);
	}

	if ( generator.bindingGroups.length ) {
		constructorBlock.addLine( `this._bindingGroups = [ ${Array( generator.bindingGroups.length ).fill( '[]' ).join( ', ' )} ];` );
	}

	constructorBlock.addBlock( deindent`
		this._observers = {
			pre: Object.create( null ),
			post: Object.create( null )
		};

		this._handlers = Object.create( null );

		this._root = options._root;
		this._yield = options._yield;

		${builders.init}
	` );

	builders.main.addBlock( deindent`
		function ${name} ( options ) {
			${constructorBlock}
		}
	` );

	const sharedPath = options.shared === true ? 'svelte/shared.js' : options.shared;

	const prototypeBase = `${name}.prototype` + ( templateProperties.methods ? `, ${generator.alias( 'template' )}.methods` : '' );
	const proto = sharedPath ? `${generator.helper( 'proto' )} ` : deindent`
		{
			${
				[ 'get', 'fire', 'observe', 'on', 'set', '_flush' ]
					.map( n => `${n}: ${generator.helper( n )}` )
					.join( ',\n' )
			}
		}`;

	builders.main.addBlock( `${generator.helper( 'assign' )}( ${prototypeBase}, ${proto});` );

	// TODO deprecate component.teardown()
	builders.main.addBlock( deindent`
		${name}.prototype._set = function _set ( newState ) {
			${builders._set}
		};

		${name}.prototype.teardown = ${name}.prototype.destroy = function destroy ( detach ) {
			this.fire( 'destroy' );${templateProperties.ondestroy ? `\n${generator.alias( 'template' )}.ondestroy.call( this );` : ``}

			this._fragment.destroy( detach !== false );
			this._fragment = null;

			this._state = {};
			this._torndown = true;
		};
	` );

	if ( sharedPath ) {
		if ( format !== 'es' ) {
			throw new Error( `Components with shared helpers must be compiled to ES2015 modules (format: 'es')` );
		}

		const names = Array.from( generator.uses ).map( name => {
			return name !== generator.alias( name ) ? `${name} as ${generator.alias( name )}` : name;
		});

		builders.main.addLineAtStart(
			`import { ${names.join( ', ' )} } from ${JSON.stringify( sharedPath )};`
		);
	} else {
		generator.uses.forEach( key => {
			const fn = shared[ key ]; // eslint-disable-line import/namespace
			builders.main.addBlock( fn.toString().replace( /^function [^(]*/, 'function ' + generator.alias( key ) ) );
		});
	}

	return generator.generate( builders.main.toString(), options, { name, format } );
}

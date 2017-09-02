import { appendNode, assign, createComment, createElement, createText, detachNode, insertNode, noop, proto } from "svelte/shared.js";

function create_main_fragment ( state, component ) {
	var div, text, p, text_1, text_2, text_3, text_4, p_1, text_5, text_6, text_8, if_block_4_anchor;

	var if_block = (state.a) && create_if_block( state, component );

	var if_block_1 = (state.b) && create_if_block_1( state, component );

	var if_block_2 = (state.c) && create_if_block_2( state, component );

	var if_block_3 = (state.d) && create_if_block_3( state, component );

	var if_block_4 = (state.e) && create_if_block_4( state, component );

	return {
		create: function () {
			div = createElement( 'div' );
			if ( if_block ) if_block.create();
			text = createText( "\n\n\t" );
			p = createElement( 'p' );
			text_1 = createText( "this can be used as an anchor" );
			text_2 = createText( "\n\n\t" );
			if ( if_block_1 ) if_block_1.create();
			text_3 = createText( "\n\n\t" );
			if ( if_block_2 ) if_block_2.create();
			text_4 = createText( "\n\n\t" );
			p_1 = createElement( 'p' );
			text_5 = createText( "so can this" );
			text_6 = createText( "\n\n\t" );
			if ( if_block_3 ) if_block_3.create();
			text_8 = createText( "\n\n" );
			if ( if_block_4 ) if_block_4.create();
			if_block_4_anchor = createComment();
		},

		mount: function ( target, anchor ) {
			insertNode( div, target, anchor );
			if ( if_block ) if_block.mount( div, null );
			appendNode( text, div );
			appendNode( p, div );
			appendNode( text_1, p );
			appendNode( text_2, div );
			if ( if_block_1 ) if_block_1.mount( div, null );
			appendNode( text_3, div );
			if ( if_block_2 ) if_block_2.mount( div, null );
			appendNode( text_4, div );
			appendNode( p_1, div );
			appendNode( text_5, p_1 );
			appendNode( text_6, div );
			if ( if_block_3 ) if_block_3.mount( div, null );
			insertNode( text_8, target, anchor );
			if ( if_block_4 ) if_block_4.mount( target, anchor );
			insertNode( if_block_4_anchor, target, anchor );
		},

		update: function ( changed, state ) {
			if ( state.a ) {
				if ( !if_block ) {
					if_block = create_if_block( state, component );
					if_block.create();
					if_block.mount( div, text );
				}
			} else if ( if_block ) {
				if_block.unmount();
				if_block.destroy();
				if_block = null;
			}

			if ( state.b ) {
				if ( !if_block_1 ) {
					if_block_1 = create_if_block_1( state, component );
					if_block_1.create();
					if_block_1.mount( div, text_3 );
				}
			} else if ( if_block_1 ) {
				if_block_1.unmount();
				if_block_1.destroy();
				if_block_1 = null;
			}

			if ( state.c ) {
				if ( !if_block_2 ) {
					if_block_2 = create_if_block_2( state, component );
					if_block_2.create();
					if_block_2.mount( div, text_4 );
				}
			} else if ( if_block_2 ) {
				if_block_2.unmount();
				if_block_2.destroy();
				if_block_2 = null;
			}

			if ( state.d ) {
				if ( !if_block_3 ) {
					if_block_3 = create_if_block_3( state, component );
					if_block_3.create();
					if_block_3.mount( div, null );
				}
			} else if ( if_block_3 ) {
				if_block_3.unmount();
				if_block_3.destroy();
				if_block_3 = null;
			}

			if ( state.e ) {
				if ( !if_block_4 ) {
					if_block_4 = create_if_block_4( state, component );
					if_block_4.create();
					if_block_4.mount( if_block_4_anchor.parentNode, if_block_4_anchor );
				}
			} else if ( if_block_4 ) {
				if_block_4.unmount();
				if_block_4.destroy();
				if_block_4 = null;
			}
		},

		unmount: function () {
			detachNode( div );
			if ( if_block ) if_block.unmount();
			if ( if_block_1 ) if_block_1.unmount();
			if ( if_block_2 ) if_block_2.unmount();
			if ( if_block_3 ) if_block_3.unmount();
			detachNode( text_8 );
			if ( if_block_4 ) if_block_4.unmount();
			detachNode( if_block_4_anchor );
		},

		destroy: function () {
			if ( if_block ) if_block.destroy();
			if ( if_block_1 ) if_block_1.destroy();
			if ( if_block_2 ) if_block_2.destroy();
			if ( if_block_3 ) if_block_3.destroy();
			if ( if_block_4 ) if_block_4.destroy();
		}
	};
}

function create_if_block ( state, component ) {
	var p, text;

	return {
		create: function () {
			p = createElement( 'p' );
			text = createText( "a" );
		},

		mount: function ( target, anchor ) {
			insertNode( p, target, anchor );
			appendNode( text, p );
		},

		unmount: function () {
			detachNode( p );
		},

		destroy: noop
	};
}

function create_if_block_1 ( state, component ) {
	var p, text;

	return {
		create: function () {
			p = createElement( 'p' );
			text = createText( "b" );
		},

		mount: function ( target, anchor ) {
			insertNode( p, target, anchor );
			appendNode( text, p );
		},

		unmount: function () {
			detachNode( p );
		},

		destroy: noop
	};
}

function create_if_block_2 ( state, component ) {
	var p, text;

	return {
		create: function () {
			p = createElement( 'p' );
			text = createText( "c" );
		},

		mount: function ( target, anchor ) {
			insertNode( p, target, anchor );
			appendNode( text, p );
		},

		unmount: function () {
			detachNode( p );
		},

		destroy: noop
	};
}

function create_if_block_3 ( state, component ) {
	var p, text;

	return {
		create: function () {
			p = createElement( 'p' );
			text = createText( "d" );
		},

		mount: function ( target, anchor ) {
			insertNode( p, target, anchor );
			appendNode( text, p );
		},

		unmount: function () {
			detachNode( p );
		},

		destroy: noop
	};
}

function create_if_block_4 ( state, component ) {
	var p, text;

	return {
		create: function () {
			p = createElement( 'p' );
			text = createText( "e" );
		},

		mount: function ( target, anchor ) {
			insertNode( p, target, anchor );
			appendNode( text, p );
		},

		unmount: function () {
			detachNode( p );
		},

		destroy: noop
	};
}

function SvelteComponent ( options ) {
	this.options = options;
	this._state = options.data || {};

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	this._fragment = create_main_fragment( this._state, this );

	if ( !options._root ) {
		this._fragment.create();
		this._fragment.mount( options.target, options.anchor || null );
	}
}

assign( SvelteComponent.prototype, proto );

export default SvelteComponent;
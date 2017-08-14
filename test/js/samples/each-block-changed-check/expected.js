import { appendNode, assign, createElement, createText, destroyEach, detachBetween, detachNode, insertNode, noop, proto } from "svelte/shared.js";

function create_main_fragment ( state, component ) {
	var text, p, text_1;

	var each_block_value = state.comments;

	var each_block_iterations = [];

	for ( var i = 0; i < each_block_value.length; i += 1 ) {
		each_block_iterations[i] = create_each_block( state, each_block_value, each_block_value[i], i, component );
	}

	return {
		create: function () {
			for ( var i = 0; i < each_block_iterations.length; i += 1 ) {
				each_block_iterations[i].create();
			}

			text = createText( "\n\n" );
			p = createElement( 'p' );
			text_1 = createText( state.foo );
		},

		mount: function ( target, anchor ) {
			for ( var i = 0; i < each_block_iterations.length; i += 1 ) {
				each_block_iterations[i].mount( target, anchor );
			}

			insertNode( text, target, anchor );
			insertNode( p, target, anchor );
			appendNode( text_1, p );
		},

		update: function ( changed, state ) {
			var each_block_value = state.comments;

			if ( changed.comments || changed.elapsed || changed.time ) {
				for ( var i = 0; i < each_block_value.length; i += 1 ) {
					if ( each_block_iterations[i] ) {
						each_block_iterations[i].update( changed, state, each_block_value, each_block_value[i], i );
					} else {
						each_block_iterations[i] = create_each_block( state, each_block_value, each_block_value[i], i, component );
						each_block_iterations[i].create();
						each_block_iterations[i].mount( text.parentNode, text );
					}
				}

				for ( ; i < each_block_iterations.length; i += 1 ) {
					each_block_iterations[i].unmount();
					each_block_iterations[i].destroy();
				}
				each_block_iterations.length = each_block_value.length;
			}

			if ( changed.foo ) {
				text_1.data = state.foo;
			}
		},

		unmount: function () {
			for ( var i = 0; i < each_block_iterations.length; i += 1 ) {
				each_block_iterations[i].unmount();
			}

			detachNode( text );
			detachNode( p );
		},

		destroy: function () {
			destroyEach( each_block_iterations, false, 0 );
		}
	};
}

function create_each_block ( state, each_block_value, comment, i, component ) {
	var div, strong, text, text_1, span, text_2_value = comment.author, text_2, text_3, text_4_value = state.elapsed(comment.time, state.time), text_4, text_5, text_6, raw_value = comment.html, raw_before, raw_after;

	return {
		create: function () {
			div = createElement( 'div' );
			strong = createElement( 'strong' );
			text = createText( i );
			text_1 = createText( "\n\n\t\t" );
			span = createElement( 'span' );
			text_2 = createText( text_2_value );
			text_3 = createText( " wrote " );
			text_4 = createText( text_4_value );
			text_5 = createText( " ago:" );
			text_6 = createText( "\n\n\t\t" );
			raw_before = createElement( 'noscript' );
			raw_after = createElement( 'noscript' );
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			div.className = "comment";
			span.className = "meta";
		},

		mount: function ( target, anchor ) {
			insertNode( div, target, anchor );
			appendNode( strong, div );
			appendNode( text, strong );
			appendNode( text_1, div );
			appendNode( span, div );
			appendNode( text_2, span );
			appendNode( text_3, span );
			appendNode( text_4, span );
			appendNode( text_5, span );
			appendNode( text_6, div );
			appendNode( raw_before, div );
			appendNode( raw_after, div );
			raw_before.insertAdjacentHTML( 'afterend', raw_value );
		},

		update: function ( changed, state, each_block_value, comment, i ) {
			if ( ( changed.comments ) && text_2_value !== ( text_2_value = comment.author ) ) {
				text_2.data = text_2_value;
			}

			if ( ( changed.elapsed || changed.comments || changed.time ) && text_4_value !== ( text_4_value = state.elapsed(comment.time, state.time) ) ) {
				text_4.data = text_4_value;
			}

			if ( ( changed.comments ) && raw_value !== ( raw_value = comment.html ) ) {
				detachBetween( raw_before, raw_after );
				raw_before.insertAdjacentHTML( 'afterend', raw_value );
			}
		},

		unmount: function () {
			detachBetween( raw_before, raw_after );

			detachNode( div );
		},

		destroy: noop
	};
}

function SvelteComponent ( options ) {
	options = options || {};
	this._state = options.data || {};

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;

	this._fragment = create_main_fragment( this._state, this );

	if ( options.target ) {
		this._fragment.create();
		this._fragment.mount( options.target, null );
	}
}

assign( SvelteComponent.prototype, proto );

export default SvelteComponent;
import { appendNode, assign, createElement, createText, detachNode, dispatchObservers, insertNode, proto } from "svelte/shared.js";

var template = (function () {
	return {
		methods: {
			foo ( bar ) {
				console.log( bar );
			}
		},
		events: {
			foo ( node, callback ) {
				// code goes here
			}
		}
	};
}());

function create_main_fragment ( state, component ) {
	var button = createElement( 'button' );

	var foo_handler = template.events.foo.call( component, button, function ( event ) {
		var state = component.get();
		component.foo( state.bar );
	});

	appendNode( createText( "foo" ), button );

	return {
		mount: function ( target, anchor ) {
			insertNode( button, target, anchor );
		},

		unmount: function () {
			detachNode( button );
		},

		destroy: function () {
			foo_handler.teardown();
		}
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

	this._torndown = false;

	this._fragment = create_main_fragment( this._state, this );
	if ( options.target ) this._fragment.mount( options.target, null );
}

assign( SvelteComponent.prototype, template.methods, proto );

SvelteComponent.prototype._set = function _set ( newState ) {
	var oldState = this._state;
	this._state = assign( {}, oldState, newState );
	dispatchObservers( this, this._observers.pre, newState, oldState );
	dispatchObservers( this, this._observers.post, newState, oldState );
};

SvelteComponent.prototype.teardown = SvelteComponent.prototype.destroy = function destroy ( detach ) {
	this.fire( 'destroy' );

	if ( detach !== false ) this._fragment.unmount();
	this._fragment.destroy( false ); // TODO no arguments to destroy
	this._fragment = null;

	this._state = {};
	this._torndown = true;
};

export default SvelteComponent;
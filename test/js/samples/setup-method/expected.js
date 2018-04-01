/* generated by Svelte vX.Y.Z */
import { assign, init, noop, proto } from "svelte/shared.js";

var methods = {
	foo ( bar ) {
		console.log( bar );
	}
};

function setup(Component) {
	Component.SOME_CONSTANT = 42;
	Component.factory = function (target) {
		return new Component({
			target: target
		});
	}
	Component.prototype.foo( 'baz' );
}

function create_main_fragment(component, state) {

	return {
		c: noop,

		m: noop,

		p: noop,

		u: noop,

		d: noop
	};
}

function SvelteComponent(options) {
	init(this, options);
	this._state = assign({}, options.data);

	this._fragment = create_main_fragment(this, this._state);

	if (options.target) {
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(assign(SvelteComponent.prototype, methods), proto);

setup(SvelteComponent);
export default SvelteComponent;
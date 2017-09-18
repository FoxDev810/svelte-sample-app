/* generated by Svelte vX.Y.Z */

import { assign, createElement, detachNode, init, insertNode, noop, proto, setInputType } from "svelte/shared.js";

function create_main_fragment(state, component) {
	var input;

	return {
		create: function() {
			input = createElement("input");
			this.hydrate();
		},

		hydrate: function() {
			setInputType(input, "search");
		},

		mount: function(target, anchor) {
			insertNode(input, target, anchor);
		},

		update: noop,

		unmount: function() {
			detachNode(input);
		},

		destroy: noop
	};
}

function SvelteComponent(options) {
	init(this, options);
	this._state = options.data || {};

	this._fragment = create_main_fragment(this._state, this);

	if (options.target) {
		this._fragment.create();
		this._fragment.mount(options.target, options.anchor || null);
	}
}

assign(SvelteComponent.prototype, proto);

export default SvelteComponent;
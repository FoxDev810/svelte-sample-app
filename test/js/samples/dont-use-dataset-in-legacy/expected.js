/* generated by Svelte vX.Y.Z */
import { assign, createElement, createText, detachNode, init, insert, proto, setAttribute } from "svelte/shared.js";

function create_main_fragment(component, ctx) {
	var div0, text, div1;

	return {
		c() {
			div0 = createElement("div");
			text = createText("\n");
			div1 = createElement("div");
			setAttribute(div0, "data-foo", "bar");
			setAttribute(div1, "data-foo", ctx.bar);
		},

		m(target, anchor) {
			insert(target, div0, anchor);
			insert(target, text, anchor);
			insert(target, div1, anchor);
		},

		p(changed, ctx) {
			if (changed.bar) {
				setAttribute(div1, "data-foo", ctx.bar);
			}
		},

		d(detach) {
			if (detach) {
				detachNode(div0);
				detachNode(text);
				detachNode(div1);
			}
		}
	};
}

function SvelteComponent(options) {
	init(this, options);
	this._state = assign({}, options.data);
	this._intro = true;

	this._fragment = create_main_fragment(this, this._state);

	if (options.target) {
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(SvelteComponent.prototype, proto);
export default SvelteComponent;
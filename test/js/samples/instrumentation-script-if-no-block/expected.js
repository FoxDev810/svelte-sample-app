/* generated by Svelte vX.Y.Z */
import { SvelteComponent as SvelteComponent_1, addListener, append, createElement, createText, detachNode, init, insert, run, safe_not_equal, setData } from "svelte/internal.js";

function create_fragment(component, ctx) {
	var button, text1, p, text2, text3, current, dispose;

	return {
		c() {
			button = createElement("button");
			button.textContent = "foo";
			text1 = createText("\n\n");
			p = createElement("p");
			text2 = createText("x: ");
			text3 = createText(ctx.x);
			dispose = addListener(button, "click", ctx.foo);
		},

		m(target, anchor) {
			insert(target, button, anchor);
			insert(target, text1, anchor);
			insert(target, p, anchor);
			append(p, text2);
			append(p, text3);
			current = true;
		},

		p(changed, ctx) {
			if (changed.x) {
				setData(text3, ctx.x);
			}
		},

		i(target, anchor) {
			if (current) return;
			this.m(target, anchor);
		},

		o: run,

		d(detach) {
			if (detach) {
				detachNode(button);
				detachNode(text1);
				detachNode(p);
			}

			dispose();
		}
	};
}

function define($$self, $$props, $$make_dirty) {
	let x = 0;

	function foo() {
		if (true) { x += 1; $$make_dirty('x'); }
	}

	$$self.$$.get = () => ({ x, foo });
}

class SvelteComponent extends SvelteComponent_1 {
	constructor(options) {
		super();
		init(this, options, define, create_fragment, safe_not_equal);
	}
}

export default SvelteComponent;
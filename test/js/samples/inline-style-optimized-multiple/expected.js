/* generated by Svelte vX.Y.Z */
import { SvelteComponent as SvelteComponent_1, createElement, detachNode, flush, init, insert, run, safe_not_equal, setStyle } from "svelte/internal.js";

function create_fragment(component, ctx) {
	var div, current;

	return {
		c() {
			div = createElement("div");
			setStyle(div, "color", ctx.color);
			setStyle(div, "transform", "translate(" + ctx.x + "px," + ctx.y + "px)");
		},

		m(target, anchor) {
			insert(target, div, anchor);
			current = true;
		},

		p(changed, ctx) {
			if (changed.color) {
				setStyle(div, "color", ctx.color);
			}

			if (changed.x || changed.y) {
				setStyle(div, "transform", "translate(" + ctx.x + "px," + ctx.y + "px)");
			}
		},

		i(target, anchor) {
			if (current) return;
			this.m(target, anchor);
		},

		o: run,

		d(detach) {
			if (detach) {
				detachNode(div);
			}
		}
	};
}

function define($$self, $$props) {
	let { color, x, y } = $$props;

	$$self.$$.get = () => ({ color, x, y });

	$$self.$$.set = $$props => {
		if ('color' in $$props) color = $$props.color;
		if ('x' in $$props) x = $$props.x;
		if ('y' in $$props) y = $$props.y;
	};
}

class SvelteComponent extends SvelteComponent_1 {
	constructor(options) {
		super();
		init(this, options, define, create_fragment, safe_not_equal);
	}

	get color() {
		return this.$$.get().color;
	}

	set color(value) {
		this.$set({ color: value });
		flush();
	}

	get x() {
		return this.$$.get().x;
	}

	set x(value) {
		this.$set({ x: value });
		flush();
	}

	get y() {
		return this.$$.get().y;
	}

	set y(value) {
		this.$set({ y: value });
		flush();
	}
}

export default SvelteComponent;
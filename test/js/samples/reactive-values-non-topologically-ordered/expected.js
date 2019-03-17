/* generated by Svelte vX.Y.Z */
import { SvelteComponent as SvelteComponent_1, init, noop, safe_not_equal } from "svelte/internal";

function create_fragment(ctx) {
	return {
		c: noop,
		m: noop,
		p: noop,
		i: noop,
		o: noop,
		d: noop
	};
}

function instance($$self, $$props, $$invalidate) {
	let { x } = $$props;

	let a;
	let b;

	$$self.$set = $$props => {
		if ('x' in $$props) $$invalidate('x', x = $$props.x);
	};

	$$self.$$.update = ($$dirty = { x: 1, b: 1 }) => {
		if ($$dirty.x) {
			b = x; $$invalidate('b', b);
		}
		if ($$dirty.b) {
			a = b; $$invalidate('a', a);
		}
	};

	return { x };
}

class SvelteComponent extends SvelteComponent_1 {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, ["x"]);
	}
}

export default SvelteComponent;
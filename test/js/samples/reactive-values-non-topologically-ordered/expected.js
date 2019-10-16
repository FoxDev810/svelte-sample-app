import { SvelteComponent, init, noop, safe_not_equal } from "svelte/internal";

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
		if ("x" in $$props) $$invalidate("x", x = $$props.x);
	};

	$$self.$$.update = (changed = { x: 1, b: 1 }) => {
		if (changed.x) {
			$: $$invalidate("b", b = x);
		}

		if (changed.b) {
			$: a = b;
		}
	};

	return { x };
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, ["x"]);
	}
}

export default Component;
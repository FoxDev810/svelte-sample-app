import {
	SvelteComponent,
	append,
	detach,
	element,
	init,
	insert,
	noop,
	safe_not_equal,
	set_data,
	text
} from "svelte/internal";

import { onMount } from "svelte";

function create_fragment(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(ctx.y);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, t);
		},
		p(changed, ctx) {
			if (changed.y) set_data(t, ctx.y);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let a, b, c;

	onMount(() => {
		const interval = setInterval(
			() => {
				$$invalidate("b", b += 1);
				c += 1;
				console.log(b, c);
			},
			1000
		);

		return () => clearInterval(interval);
	});

	let x;
	let y;

	$$self.$$.update = (changed = { a: 1, b: 1 }) => {
		if (changed.a) {
			$: x = a * 2;
		}

		if (changed.b) {
			$: $$invalidate("y", y = b * 2);
		}
	};

	return { y };
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, []);
	}
}

export default Component;
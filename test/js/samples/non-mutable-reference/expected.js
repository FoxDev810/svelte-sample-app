import {
	SvelteComponent,
	append,
	detach,
	element,
	init,
	insert,
	noop,
	safe_not_equal,
	text
} from "svelte/internal";

function create_fragment(ctx) {
	let h1;
	let t0;
	let t1;
	let t2;

	return {
		c() {
			h1 = element("h1");
			t0 = text("Hello ");
			t1 = text(name);
			t2 = text("!");
		},
		m(target, anchor) {
			insert(target, h1, anchor);
			append(h1, t0);
			append(h1, t1);
			append(h1, t2);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h1);
		}
	};
}

let name = "world";

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, []);
	}
}

export default Component;
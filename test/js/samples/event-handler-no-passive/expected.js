import {
	SvelteComponent,
	attr,
	detach,
	element,
	init,
	insert,
	listen,
	noop,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let a;
	let dispose;

	return {
		c() {
			a = element("a");
			a.textContent = "this should not navigate to example.com";
			attr(a, "href", "https://example.com");
			dispose = listen(a, "touchstart", touchstart_handler);
		},
		m(target, anchor) {
			insert(target, a, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(a);
			dispose();
		}
	};
}

const touchstart_handler = e => e.preventDefault();

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, []);
	}
}

export default Component;
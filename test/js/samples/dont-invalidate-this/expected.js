import {
	SvelteComponent,
	detach,
	element,
	init,
	insert,
	listen,
	noop,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let input;
	let dispose;

	return {
		c() {
			input = element("input");
			dispose = listen(input, "input", make_uppercase);
		},
		m(target, anchor) {
			insert(target, input, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(input);
			dispose();
		}
	};
}

function make_uppercase() {
	this.value = this.value.toUpperCase();
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, {});
	}
}

export default Component;
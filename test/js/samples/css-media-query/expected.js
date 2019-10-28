import {
	SvelteComponent,
	append,
	attr,
	detach,
	element,
	init,
	insert,
	noop,
	safe_not_equal
} from "svelte/internal";

function add_css() {
	var style = element("style");
	style.id = "svelte-1slhpfn-style";
	style.textContent = "@media(min-width: 1px){div.svelte-1slhpfn{color:red}}";
	append(document.head, style);
}

function create_fragment(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "svelte-1slhpfn");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1slhpfn-style")) add_css();
		init(this, options, null, create_fragment, safe_not_equal, {});
	}
}

export default Component;
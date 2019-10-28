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

const SOME_CONSTANT = 42;

function foo(bar) {
	console.log(bar);
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, { foo: 0 });
	}

	get foo() {
		return foo;
	}
}

export default Component;
export { SOME_CONSTANT };
import {
	SvelteComponent,
	append,
	detach,
	element,
	init,
	insert,
	listen,
	noop,
	safe_not_equal,
	set_data,
	set_input_value,
	space,
	text
} from "svelte/internal";

function create_fragment(ctx) {
	let p;
	let t0;
	let t1;
	let input;
	let dispose;

	return {
		c() {
			p = element("p");
			t0 = text(ctx.foo);
			t1 = space();
			input = element("input");
			dispose = listen(input, "input", ctx.input_input_handler);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, t0);
			insert(target, t1, anchor);
			insert(target, input, anchor);
			set_input_value(input, ctx.foo);
		},
		p(changed, ctx) {
			if (changed.foo) set_data(t0, ctx.foo);

			if (changed.foo && input.value !== ctx.foo) {
				set_input_value(input, ctx.foo);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(p);
			if (detaching) detach(t1);
			if (detaching) detach(input);
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let foo = "bar";

	function input_input_handler() {
		foo = this.value;
		$$invalidate("foo", foo);
	}

	return { foo, input_input_handler };
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, []);
	}
}

export default Component;
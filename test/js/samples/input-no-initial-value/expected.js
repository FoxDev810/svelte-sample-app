import {
	SvelteComponent,
	append,
	attr,
	detach,
	element,
	init,
	insert,
	listen,
	noop,
	run_all,
	safe_not_equal,
	set_input_value,
	space
} from "svelte/internal";

function create_fragment(ctx) {
	let form;
	let input;
	let t0;
	let button;
	let dispose;

	return {
		c() {
			form = element("form");
			input = element("input");
			t0 = space();
			button = element("button");
			button.textContent = "Store";
			attr(input, "type", "text");
			input.required = true;

			dispose = [
				listen(input, "input", ctx.input_input_handler),
				listen(form, "submit", ctx.handleSubmit)
			];
		},
		m(target, anchor) {
			insert(target, form, anchor);
			append(form, input);
			set_input_value(input, ctx.test);
			append(form, t0);
			append(form, button);
		},
		p(changed, ctx) {
			if (changed.test && input.value !== ctx.test) {
				set_input_value(input, ctx.test);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(form);
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let test = undefined;

	function handleSubmit(event) {
		event.preventDefault();
		console.log("value", test);
	}

	function input_input_handler() {
		test = this.value;
		$$invalidate("test", test);
	}

	return {
		test,
		handleSubmit,
		input_input_handler
	};
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default Component;
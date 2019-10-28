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
	space,
	text
} from "svelte/internal";

function create_fragment(ctx) {
	let button;
	let t1;
	let p;
	let t2;
	let t3_value = ctx.things.length + "";
	let t3;
	let dispose;

	return {
		c() {
			button = element("button");
			button.textContent = "foo";
			t1 = space();
			p = element("p");
			t2 = text("number of things: ");
			t3 = text(t3_value);
			dispose = listen(button, "click", ctx.click_handler);
		},
		m(target, anchor) {
			insert(target, button, anchor);
			insert(target, t1, anchor);
			insert(target, p, anchor);
			append(p, t2);
			append(p, t3);
		},
		p(changed, ctx) {
			if (changed.things && t3_value !== (t3_value = ctx.things.length + "")) set_data(t3, t3_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(button);
			if (detaching) detach(t1);
			if (detaching) detach(p);
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let things = [];

	const click_handler = () => {
		things.push(1);
		$$invalidate("things", things);
	};

	return { things, click_handler };
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default Component;
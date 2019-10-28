import {
	SvelteComponent,
	append,
	detach,
	element,
	init,
	insert,
	noop,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let select;
	let option0;
	let option1;
	let select_value_value;

	return {
		c() {
			select = element("select");
			option0 = element("option");
			option0.textContent = "1";
			option1 = element("option");
			option1.textContent = "2";
			option0.__value = "1";
			option0.value = option0.__value;
			option1.__value = "2";
			option1.value = option1.__value;
		},
		m(target, anchor) {
			insert(target, select, anchor);
			append(select, option0);
			append(select, option1);
			select_value_value = ctx.current;

			for (var i = 0; i < select.options.length; i += 1) {
				var option = select.options[i];

				if (option.__value === select_value_value) {
					option.selected = true;
					break;
				}
			}
		},
		p(changed, ctx) {
			if (changed.current && select_value_value !== (select_value_value = ctx.current)) {
				for (var i = 0; i < select.options.length; i += 1) {
					var option = select.options[i];

					if (option.__value === select_value_value) {
						option.selected = true;
						break;
					}
				}
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(select);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { current } = $$props;

	$$self.$set = $$props => {
		if ("current" in $$props) $$invalidate("current", current = $$props.current);
	};

	return { current };
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { current: 0 });
	}
}

export default Component;
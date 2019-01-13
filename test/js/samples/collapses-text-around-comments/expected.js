/* generated by Svelte vX.Y.Z */
import { SvelteComponent as SvelteComponent_1, append, createElement, createText, detachNode, flush, init, insert, noop, safe_not_equal, setData } from "svelte/internal";

function add_css() {
	var style = createElement("style");
	style.id = 'svelte-1a7i8ec-style';
	style.textContent = "p.svelte-1a7i8ec{color:red}";
	append(document.head, style);
}

function create_fragment($$, ctx) {
	var p, text;

	return {
		c() {
			p = createElement("p");
			text = createText(ctx.foo);
			p.className = "svelte-1a7i8ec";
		},

		m(target, anchor) {
			insert(target, p, anchor);
			append(p, text);
		},

		p(changed, ctx) {
			if (changed.foo) {
				setData(text, ctx.foo);
			}
		},

		i: noop,
		o: noop,

		d(detach) {
			if (detach) {
				detachNode(p);
			}
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { foo = 42 } = $$props;

	$$self.$set = $$props => {
		if ('foo' in $$props) $$invalidate('foo', foo = $$props.foo);
	};

	return { foo };
}

class SvelteComponent extends SvelteComponent_1 {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1a7i8ec-style")) add_css();
		init(this, options, instance, create_fragment, safe_not_equal);
	}

	get foo() {
		return this.$$.ctx.foo;
	}

	set foo(foo) {
		this.$set({ foo });
		flush();
	}
}

export default SvelteComponent;
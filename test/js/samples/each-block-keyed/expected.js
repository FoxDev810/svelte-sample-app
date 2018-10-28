/* generated by Svelte vX.Y.Z */
import { append, assign, blankObject, createComment, createElement, createText, destroyBlock, detachNode, init, insert, proto, setData, updateKeyedEach } from "svelte/shared.js";

function get_each_context(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.thing = list[i];
	return child_ctx;
}

function create_main_fragment(component, ctx) {
	var each_blocks_1 = [], each_lookup = blankObject(), each_anchor;

	var each_value = ctx.things;

	const get_key = ctx => ctx.thing.id;

	for (var i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_blocks_1[i] = each_lookup[key] = create_each_block(component, key, child_ctx);
	}

	return {
		c() {
			for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].c();

			each_anchor = createComment();
		},

		m(target, anchor) {
			for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].m(target, anchor);

			insert(target, each_anchor, anchor);
		},

		p(changed, ctx) {
			const each_value = ctx.things;
			each_blocks_1 = updateKeyedEach(each_blocks_1, component, changed, get_key, 1, ctx, each_value, each_lookup, each_anchor.parentNode, destroyBlock, create_each_block, "m", each_anchor, get_each_context);
		},

		d(detach) {
			for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].d(detach);

			if (detach) {
				detachNode(each_anchor);
			}
		}
	};
}

// (1:0) {#each things as thing (thing.id)}
function create_each_block(component, key_1, ctx) {
	var div, text_value = ctx.thing.name, text;

	return {
		key: key_1,

		first: null,

		c() {
			div = createElement("div");
			text = createText(text_value);
			this.first = div;
		},

		m(target, anchor) {
			insert(target, div, anchor);
			append(div, text);
		},

		p(changed, ctx) {
			if ((changed.things) && text_value !== (text_value = ctx.thing.name)) {
				setData(text, text_value);
			}
		},

		d(detach) {
			if (detach) {
				detachNode(div);
			}
		}
	};
}

function SvelteComponent(options) {
	init(this, options);
	this._state = assign({}, options.data);
	this._intro = true;

	this._fragment = create_main_fragment(this, this._state);

	if (options.target) {
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(SvelteComponent.prototype, proto);
export default SvelteComponent;
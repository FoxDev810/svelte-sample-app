function noop() {}

function assign(tar, src) {
	for (var k in src) tar[k] = src[k];
	return tar;
}

function append(target, node) {
	target.appendChild(node);
}

function insert(target, node, anchor) {
	target.insertBefore(node, anchor);
}

function detachNode(node) {
	node.parentNode.removeChild(node);
}

function createElement(name) {
	return document.createElement(name);
}

function createText(data) {
	return document.createTextNode(data);
}

function createComment() {
	return document.createComment('');
}

function blankObject() {
	return Object.create(null);
}

function destroy(detach) {
	this.destroy = noop;
	this.fire('destroy');
	this.set = noop;

	this._fragment.d(detach !== false);
	this._fragment = null;
	this._state = {};
}

function _differs(a, b) {
	return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

function fire(eventName, data) {
	var handlers =
		eventName in this._handlers && this._handlers[eventName].slice();
	if (!handlers) return;

	for (var i = 0; i < handlers.length; i += 1) {
		var handler = handlers[i];

		if (!handler.__calling) {
			try {
				handler.__calling = true;
				handler.call(this, data);
			} finally {
				handler.__calling = false;
			}
		}
	}
}

function flush(component) {
	component._lock = true;
	callAll(component._beforecreate);
	callAll(component._oncreate);
	callAll(component._aftercreate);
	component._lock = false;
}

function get() {
	return this._state;
}

function init(component, options) {
	component._handlers = blankObject();
	component._slots = blankObject();
	component._bind = options._bind;

	component.options = options;
	component.root = options.root || component;
	component.store = options.store || component.root.store;

	if (!options.root) {
		component._beforecreate = [];
		component._oncreate = [];
		component._aftercreate = [];
	}
}

function on(eventName, handler) {
	var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
	handlers.push(handler);

	return {
		cancel: function() {
			var index = handlers.indexOf(handler);
			if (~index) handlers.splice(index, 1);
		}
	};
}

function set(newState) {
	this._set(assign({}, newState));
	if (this.root._lock) return;
	flush(this.root);
}

function _set(newState, options) {
	var oldState = this._state,
		changed = {},
		dirty = false;

	for (var key in newState) {
		if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
	}
	if (!dirty && !this._changed) return false;

	this._state = assign(assign({}, oldState), newState);

	if (options && options.skipRender) {
		if (!this._oldState) this._oldState = oldState;
		this._changed = assign(changed, this._changed);
		return true;
	}

	if (this._changed) {
		oldState = this._oldState;
		changed = assign(changed, this._changed),
		this._changed = this._oldState = null;
	}

	this._recompute(changed, this._state);
	if (this._bind) this._bind(changed, this._state);

	if (this._fragment) {
		this.fire("state", { changed: changed, current: this._state, previous: oldState });
		this._fragment.p(changed, this._state);
		this.fire("update", { changed: changed, current: this._state, previous: oldState });
	}
	return true;
}

function callAll(fns) {
	while (fns && fns.length) fns.shift()();
}

function _mount(target, anchor) {
	this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
}

var proto = {
	destroy,
	get,
	fire,
	on,
	set,
	_recompute: noop,
	_set,
	_mount,
	_differs
};

/* generated by Svelte vX.Y.Z */

function create_main_fragment(component, ctx) {
	var div, text, p, text_2, text_3, text_4, p_1, text_6, text_8, if_block_4_anchor;

	var if_block = (ctx.a) && create_if_block(component, ctx);

	var if_block_1 = (ctx.b) && create_if_block_1(component, ctx);

	var if_block_2 = (ctx.c) && create_if_block_2(component, ctx);

	var if_block_3 = (ctx.d) && create_if_block_3(component, ctx);

	var if_block_4 = (ctx.e) && create_if_block_4(component, ctx);

	return {
		c() {
			div = createElement("div");
			if (if_block) if_block.c();
			text = createText("\n\n\t");
			p = createElement("p");
			p.textContent = "this can be used as an anchor";
			text_2 = createText("\n\n\t");
			if (if_block_1) if_block_1.c();
			text_3 = createText("\n\n\t");
			if (if_block_2) if_block_2.c();
			text_4 = createText("\n\n\t");
			p_1 = createElement("p");
			p_1.textContent = "so can this";
			text_6 = createText("\n\n\t");
			if (if_block_3) if_block_3.c();
			text_8 = createText("\n\n");
			if (if_block_4) if_block_4.c();
			if_block_4_anchor = createComment();
		},

		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block) if_block.m(div, null);
			append(div, text);
			append(div, p);
			append(div, text_2);
			if (if_block_1) if_block_1.m(div, null);
			append(div, text_3);
			if (if_block_2) if_block_2.m(div, null);
			append(div, text_4);
			append(div, p_1);
			append(div, text_6);
			if (if_block_3) if_block_3.m(div, null);
			insert(target, text_8, anchor);
			if (if_block_4) if_block_4.m(target, anchor);
			insert(target, if_block_4_anchor, anchor);
		},

		p(changed, ctx) {
			if (ctx.a) {
				if (!if_block) {
					if_block = create_if_block(component, ctx);
					if_block.c();
					if_block.m(div, text);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (ctx.b) {
				if (!if_block_1) {
					if_block_1 = create_if_block_1(component, ctx);
					if_block_1.c();
					if_block_1.m(div, text_3);
				}
			} else if (if_block_1) {
				if_block_1.d(1);
				if_block_1 = null;
			}

			if (ctx.c) {
				if (!if_block_2) {
					if_block_2 = create_if_block_2(component, ctx);
					if_block_2.c();
					if_block_2.m(div, text_4);
				}
			} else if (if_block_2) {
				if_block_2.d(1);
				if_block_2 = null;
			}

			if (ctx.d) {
				if (!if_block_3) {
					if_block_3 = create_if_block_3(component, ctx);
					if_block_3.c();
					if_block_3.m(div, null);
				}
			} else if (if_block_3) {
				if_block_3.d(1);
				if_block_3 = null;
			}

			if (ctx.e) {
				if (!if_block_4) {
					if_block_4 = create_if_block_4(component, ctx);
					if_block_4.c();
					if_block_4.m(if_block_4_anchor.parentNode, if_block_4_anchor);
				}
			} else if (if_block_4) {
				if_block_4.d(1);
				if_block_4 = null;
			}
		},

		d(detach) {
			if (detach) {
				detachNode(div);
			}

			if (if_block) if_block.d();
			if (if_block_1) if_block_1.d();
			if (if_block_2) if_block_2.d();
			if (if_block_3) if_block_3.d();
			if (detach) {
				detachNode(text_8);
			}

			if (if_block_4) if_block_4.d(detach);
			if (detach) {
				detachNode(if_block_4_anchor);
			}
		}
	};
}

// (2:1) {#if a}
function create_if_block(component, ctx) {
	var p;

	return {
		c() {
			p = createElement("p");
			p.textContent = "a";
		},

		m(target, anchor) {
			insert(target, p, anchor);
		},

		d(detach) {
			if (detach) {
				detachNode(p);
			}
		}
	};
}

// (8:1) {#if b}
function create_if_block_1(component, ctx) {
	var p;

	return {
		c() {
			p = createElement("p");
			p.textContent = "b";
		},

		m(target, anchor) {
			insert(target, p, anchor);
		},

		d(detach) {
			if (detach) {
				detachNode(p);
			}
		}
	};
}

// (12:1) {#if c}
function create_if_block_2(component, ctx) {
	var p;

	return {
		c() {
			p = createElement("p");
			p.textContent = "c";
		},

		m(target, anchor) {
			insert(target, p, anchor);
		},

		d(detach) {
			if (detach) {
				detachNode(p);
			}
		}
	};
}

// (18:1) {#if d}
function create_if_block_3(component, ctx) {
	var p;

	return {
		c() {
			p = createElement("p");
			p.textContent = "d";
		},

		m(target, anchor) {
			insert(target, p, anchor);
		},

		d(detach) {
			if (detach) {
				detachNode(p);
			}
		}
	};
}

// (25:0) {#if e}
function create_if_block_4(component, ctx) {
	var p;

	return {
		c() {
			p = createElement("p");
			p.textContent = "e";
		},

		m(target, anchor) {
			insert(target, p, anchor);
		},

		d(detach) {
			if (detach) {
				detachNode(p);
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

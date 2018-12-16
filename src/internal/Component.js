import { add_render_callback, flush, intro, schedule_update } from './scheduler.js';
import { current_component, set_current_component } from './lifecycle.js'
import { is_function, run, run_all, noop } from './utils.js';
import { blankObject } from './utils.js';
import { children } from './dom.js';

export function bind(component, name, callback) {
	component.$$.bound[name] = callback;
	callback(component.$$.get()[name]);
}

export function mount_component(component, target, anchor) {
	const { fragment, on_mount, on_destroy, after_render } = component.$$;

	fragment[fragment.i ? 'i' : 'm'](target, anchor);

	// onMount happens after the initial afterUpdate. Because
	// afterUpdate callbacks happen in reverse order (inner first)
	// we schedule onMount callbacks before afterUpdate callbacks
	add_render_callback(() => {
		const new_on_destroy = on_mount.map(run).filter(is_function);
		if (on_destroy) {
			on_destroy.push(...new_on_destroy);
		} else {
			// Edge case — component was destroyed immediately,
			// most likely as a result of a binding initialising
			run_all(new_on_destroy);
		}
		component.$$.on_mount = [];
	});

	after_render.forEach(add_render_callback);
}

function destroy(component, detach) {
	if (component.$$) {
		run_all(component.$$.on_destroy);
		component.$$.fragment.d(detach);

		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		component.$$.on_destroy = component.$$.fragment = null;
		component.$$.get = () => ({});
	}
}

function make_dirty(component, key) {
	if (!component.$$.dirty) {
		schedule_update(component);
		component.$$.dirty = {};
	}
	component.$$.dirty[key] = true;
}

function empty() {
	return {};
}

export function init(component, options, define, create_fragment, not_equal) {
	const previous_component = current_component;
	set_current_component(component);

	component.$$ = {
		fragment: null,

		// state
		get: empty,
		set: noop,
		update: noop,
		not_equal,
		bound: blankObject(),

		// lifecycle
		on_mount: [],
		on_destroy: [],
		before_render: [],
		after_render: [],

		// everything else
		callbacks: blankObject(),
		slotted: options.slots || {},
		dirty: null,
		binding_groups: []
	};

	let ready = false;

	define(component, options.props || {}, key => {
		if (ready) make_dirty(component, key);
		if (component.$$.bound[key]) component.$$.bound[key](component.$$.get()[key]);
	});

	component.$$.update();
	ready = true;
	run_all(component.$$.before_render);
	component.$$.fragment = create_fragment(component, component.$$.get());

	if (options.target) {
		intro.enabled = !!options.intro;

		if (options.hydrate) {
			component.$$.fragment.l(children(options.target));
		} else {
			component.$$.fragment.c();
		}

		mount_component(component, options.target, options.anchor);
		flush();
		intro.enabled = true;
	}

	set_current_component(previous_component);
}

export let SvelteElement;
if (typeof HTMLElement !== 'undefined') {
	SvelteElement = class extends HTMLElement {
		constructor() {
			super();
			this.attachShadow({ mode: 'open' });
		}

		connectedCallback() {
			for (let key in this.$$.slotted) {
				this.appendChild(this.$$.slotted[key]);
			}
		}

		attributeChangedCallback(attr, oldValue, newValue) {
			this[attr] = newValue;
		}

		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			// TODO should this delegate to addEventListener?
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set(values) {
			if (this.$$) {
				const state = this.$$.get();
				this.$$.set(values);
				for (const key in values) {
					if (this.$$.not_equal(state[key], values[key])) make_dirty(this, key);
				}
			}
		}
	}
}

export class SvelteComponent {
	$destroy() {
		destroy(this, true);
		this.$destroy = noop;
	}

	$on(type, callback) {
		const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
		callbacks.push(callback);

		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	$set(values) {
		if (this.$$) {
			const state = this.$$.get();
			this.$$.set(values);
			for (const key in values) {
				if (this.$$.not_equal(state[key], values[key])) make_dirty(this, key);
			}
		}
	}
}

export class SvelteComponentDev extends SvelteComponent {
	constructor(options) {
		if (!options || (!options.target && !options.$$inline)) {
			throw new Error(`'target' is a required option`);
		}

		super();
	}

	$destroy() {
		super.$destroy();
		this.$destroy = () => {
			console.warn(`Component was already destroyed`);
		};
	}
}
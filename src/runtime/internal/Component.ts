import { add_render_callback, flush, schedule_update, dirty_components } from './scheduler';
import { current_component, set_current_component } from './lifecycle';
import { blank_object, is_function, run, run_all, noop } from './utils';
import { children } from './dom';
import { transition_in } from './transitions';

// eslint-disable-next-line @typescript-eslint/class-name-casing
interface T$$ {
	dirty: null;
	ctx: null|any;
	bound: any;
	update: () => void;
	callbacks: any;
	after_update: any[];
	props: Record<string, 0 | string>;
	fragment: null|any;
	not_equal: any;
	before_update: any[];
	context: Map<any, any>;
	on_mount: any[];
	on_destroy: any[];
}

export function bind(component, name, callback) {
	if (component.$$.props.hasOwnProperty(name)) {
		name = component.$$.props[name] || name;
		component.$$.bound[name] = callback;
		callback(component.$$.ctx[name]);
	}
}

export function mount_component(component, target, anchor) {
	const { fragment, on_mount, on_destroy, after_update } = component.$$;

	fragment.m(target, anchor);

	// onMount happens before the initial afterUpdate
	add_render_callback(() => {
		const new_on_destroy = on_mount.map(run).filter(is_function);
		if (on_destroy) {
			on_destroy.push(...new_on_destroy);
		} else {
			// Edge case - component was destroyed immediately,
			// most likely as a result of a binding initialising
			run_all(new_on_destroy);
		}
		component.$$.on_mount = [];
	});

	after_update.forEach(add_render_callback);
}

export function destroy_component(component, detaching) {
	if (component.$$.fragment) {
		run_all(component.$$.on_destroy);

		component.$$.fragment.d(detaching);

		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		component.$$.on_destroy = component.$$.fragment = null;
		component.$$.ctx = {};
	}
}

function make_dirty(component, key) {
	if (!component.$$.dirty) {
		dirty_components.push(component);
		schedule_update();
		component.$$.dirty = blank_object();
	}
	component.$$.dirty[key] = true;
}

export function init(component, options, instance, create_fragment, not_equal, props) {
	const parent_component = current_component;
	set_current_component(component);

	const prop_values = options.props || {};

	const $$: T$$ = component.$$ = {
		fragment: null,
		ctx: null,

		// state
		props,
		update: noop,
		not_equal,
		bound: blank_object(),

		// lifecycle
		on_mount: [],
		on_destroy: [],
		before_update: [],
		after_update: [],
		context: new Map(parent_component ? parent_component.$$.context : []),

		// everything else
		callbacks: blank_object(),
		dirty: null
	};

	let ready = false;

	$$.ctx = instance
		? instance(component, prop_values, (key, ret, value = ret) => {
			if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
				if ($$.bound[key]) $$.bound[key](value);
				if (ready) make_dirty(component, key);
			}
			return ret;
		})
		: prop_values;

	$$.update();
	ready = true;
	run_all($$.before_update);
	$$.fragment = create_fragment($$.ctx);

	if (options.target) {
		if (options.hydrate) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment!.l(children(options.target));
		} else {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment!.c();
		}

		if (options.intro) transition_in(component.$$.fragment);
		mount_component(component, options.target, options.anchor);
		flush();
	}

	set_current_component(parent_component);
}

export let SvelteElement;
if (typeof HTMLElement === 'function') {
	SvelteElement = class extends HTMLElement {
		$$: T$$;
		constructor() {
			super();
			this.attachShadow({ mode: 'open' });
		}

		connectedCallback() {
			// @ts-ignore todo: improve typings
			for (const key in this.$$.slotted) {
				// @ts-ignore todo: improve typings
				this.appendChild(this.$$.slotted[key]);
			}
		}

		attributeChangedCallback(attr, _oldValue, newValue) {
			this[attr] = newValue;
		}

		$destroy() {
			destroy_component(this, 1);
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

		$set() {
			// overridden by instance, if it has props
		}
	};
}

export class SvelteComponent {
	$$: T$$;

	$destroy() {
		destroy_component(this, 1);
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

	$set() {
		// overridden by instance, if it has props
	}
}

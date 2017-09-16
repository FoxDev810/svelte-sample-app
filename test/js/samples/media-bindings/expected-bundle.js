function noop() {}

function assign(target) {
	var k,
		source,
		i = 1,
		len = arguments.length;
	for (; i < len; i++) {
		source = arguments[i];
		for (k in source) target[k] = source[k];
	}

	return target;
}

function insertNode(node, target, anchor) {
	target.insertBefore(node, anchor);
}

function detachNode(node) {
	node.parentNode.removeChild(node);
}

function createElement(name) {
	return document.createElement(name);
}

function addListener(node, event, handler) {
	node.addEventListener(event, handler, false);
}

function removeListener(node, event, handler) {
	node.removeEventListener(event, handler, false);
}

function timeRangesToArray(ranges) {
	var array = [];
	for (var i = 0; i < ranges.length; i += 1) {
		array.push({ start: ranges.start(i), end: ranges.end(i) });
	}
	return array;
}

function destroy(detach) {
	this.destroy = noop;
	this.fire('destroy');
	this.set = this.get = noop;

	if (detach !== false) this._fragment.unmount();
	this._fragment.destroy();
	this._fragment = this._state = null;
}

function differs(a, b) {
	return a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

function dispatchObservers(component, group, changed, newState, oldState) {
	for (var key in group) {
		if (!changed[key]) continue;

		var newValue = newState[key];
		var oldValue = oldState[key];

		var callbacks = group[key];
		if (!callbacks) continue;

		for (var i = 0; i < callbacks.length; i += 1) {
			var callback = callbacks[i];
			if (callback.__calling) continue;

			callback.__calling = true;
			callback.call(component, newValue, oldValue);
			callback.__calling = false;
		}
	}
}

function fire(eventName, data) {
	var handlers =
		eventName in this._handlers && this._handlers[eventName].slice();
	if (!handlers) return;

	for (var i = 0; i < handlers.length; i += 1) {
		handlers[i].call(this, data);
	}
}

function get(key) {
	return key ? this._state[key] : this._state;
}

function init(component, options) {
	component.options = options;

	component._observers = {
		pre: Object.create(null),
		post: Object.create(null)
	};

	component._handlers = Object.create(null);

	component._root = options._root || component;
	component._yield = options._yield;
	component._bind = options._bind;
}

function observe(key, callback, options) {
	var group = options && options.defer
		? this._observers.post
		: this._observers.pre;

	(group[key] || (group[key] = [])).push(callback);

	if (!options || options.init !== false) {
		callback.__calling = true;
		callback.call(this, this._state[key]);
		callback.__calling = false;
	}

	return {
		cancel: function() {
			var index = group[key].indexOf(callback);
			if (~index) group[key].splice(index, 1);
		}
	};
}

function on(eventName, handler) {
	if (eventName === 'teardown') return this.on('destroy', handler);

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
	if (this._root._lock) return;
	this._root._lock = true;
	callAll(this._root._beforecreate);
	callAll(this._root._oncreate);
	callAll(this._root._aftercreate);
	this._root._lock = false;
}

function _set(newState) {
	var oldState = this._state,
		changed = {},
		dirty = false;

	for (var key in newState) {
		if (differs(newState[key], oldState[key])) changed[key] = dirty = true;
	}
	if (!dirty) return;

	this._state = assign({}, oldState, newState);
	this._recompute(changed, this._state, oldState, false);
	if (this._bind) this._bind(changed, this._state);
	dispatchObservers(this, this._observers.pre, changed, this._state, oldState);
	this._fragment.update(changed, this._state);
	dispatchObservers(this, this._observers.post, changed, this._state, oldState);
}

function callAll(fns) {
	while (fns && fns.length) fns.pop()();
}

function _mount(target, anchor) {
	this._fragment.mount(target, anchor);
}

function _unmount() {
	this._fragment.unmount();
}

var proto = {
	destroy: destroy,
	get: get,
	fire: fire,
	observe: observe,
	on: on,
	set: set,
	teardown: destroy,
	_recompute: noop,
	_set: _set,
	_mount: _mount,
	_unmount: _unmount
};

function create_main_fragment(state, component) {
	var audio, audio_updating = false, audio_animationframe, audio_paused_value = true;

	function audio_progress_loadedmetadata_handler() {
		audio_updating = true;
		component.set({ buffered: timeRangesToArray(audio.buffered) });
		audio_updating = false;
	}

	function audio_loadedmetadata_handler() {
		audio_updating = true;
		component.set({ seekable: timeRangesToArray(audio.seekable) });
		audio_updating = false;
	}

	function audio_timeupdate_handler() {
		audio_updating = true;
		component.set({ played: timeRangesToArray(audio.played) });
		audio_updating = false;
	}

	function audio_timeupdate_handler_1() {
		audio_updating = true;
		cancelAnimationFrame(audio_animationframe);
		if (!audio.paused) audio_animationframe = requestAnimationFrame(audio_timeupdate_handler_1);
		component.set({ currentTime: audio.currentTime });
		audio_updating = false;
	}

	function audio_durationchange_handler() {
		audio_updating = true;
		component.set({ duration: audio.duration });
		audio_updating = false;
	}

	function audio_pause_handler() {
		audio_updating = true;
		component.set({ paused: audio.paused });
		audio_updating = false;
	}

	return {
		create: function() {
			audio = createElement("audio");
			addListener(audio, "play", audio_pause_handler);
			this.hydrate();
		},

		hydrate: function(nodes) {
			component._root._beforecreate.push(audio_progress_loadedmetadata_handler);

			addListener(audio, "progress", audio_progress_loadedmetadata_handler);
			addListener(audio, "loadedmetadata", audio_progress_loadedmetadata_handler);

			component._root._beforecreate.push(audio_loadedmetadata_handler);

			addListener(audio, "loadedmetadata", audio_loadedmetadata_handler);

			component._root._beforecreate.push(audio_timeupdate_handler);

			addListener(audio, "timeupdate", audio_timeupdate_handler);

			component._root._beforecreate.push(audio_timeupdate_handler_1);

			addListener(audio, "timeupdate", audio_timeupdate_handler_1);

			component._root._beforecreate.push(audio_durationchange_handler);

			addListener(audio, "durationchange", audio_durationchange_handler);

			component._root._beforecreate.push(audio_pause_handler);

			addListener(audio, "pause", audio_pause_handler);
		},

		mount: function(target, anchor) {
			insertNode(audio, target, anchor);
		},

		update: function(changed, state) {
			if (!audio_updating && !isNaN(state.currentTime )) {
				audio.currentTime = state.currentTime ;
			}

			if (audio_paused_value !== (audio_paused_value = state.paused)) {
				audio[audio_paused_value ? "pause" : "play"]();
			}
		},

		unmount: function() {
			detachNode(audio);
		},

		destroy: function() {
			removeListener(audio, "progress", audio_progress_loadedmetadata_handler);
			removeListener(audio, "loadedmetadata", audio_progress_loadedmetadata_handler);
			removeListener(audio, "loadedmetadata", audio_loadedmetadata_handler);
			removeListener(audio, "timeupdate", audio_timeupdate_handler);
			removeListener(audio, "timeupdate", audio_timeupdate_handler_1);
			removeListener(audio, "durationchange", audio_durationchange_handler);
			removeListener(audio, "pause", audio_pause_handler);
			removeListener(audio, "play", audio_pause_handler);
		}
	};
}

function SvelteComponent(options) {
	init(this, options);
	this._state = options.data || {};

	if (!options._root) {
		this._oncreate = [];
		this._beforecreate = [];
	}

	this._fragment = create_main_fragment(this._state, this);

	if (options.target) {
		this._fragment.create();
		this._fragment.mount(options.target, options.anchor || null);

		callAll(this._beforecreate);
	}
}

assign(SvelteComponent.prototype, proto);

export default SvelteComponent;

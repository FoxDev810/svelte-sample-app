---
title: Run time
---


### svelte

The `svelte` package exposes [lifecycle functions](tutorial/onmount) and the [context API](tutorial/context-api).

* `onMount(callback: () => void)`
* `onMount(callback: () => () => void)`

---

The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM. It must be called during the component's initialisation (but doesn't need to live *inside* the component; it can be called from an external module).

`onMount` does not run inside a [server-side component](docs#server-side-component-api).

```html
<script>
	import { onMount } from 'svelte';

	onMount(() => {
		console.log('the component has mounted');
	});
</script>
```

---

If a function is returned from `onMount`, it will be called when the component is unmounted.

```html
<script>
	import { onMount } from 'svelte';

	onMount(() => {
		const interval = setInterval(() => {
			console.log('beep');
		}, 1000);

		return () => clearInterval(interval);
	});
</script>
```

* `beforeUpdate(callback: () => void)`

---

Schedules a callback to run immediately before the component is updated after any state change.

> The first time the callback runs will be before the initial `onMount`

```html
<script>
	import { beforeUpdate } from 'svelte';

	beforeUpdate(() => {
		console.log('the component is about to update');
	});
</script>
```

* `afterUpdate(callback: () => void)`

---

Schedules a callback to run immediately after the component has been updated.

```html
<script>
	import { afterUpdate } from 'svelte';

	afterUpdate(() => {
		console.log('the component just updated');
	});
</script>
```

* `onDestroy(callback: () => void)`

---

Schedules a callback to run once the component is unmounted.

Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the only one that runs inside a server-side component.

```html
<script>
	import { onDestroy } from 'svelte';

	onDestroy(() => {
		console.log('the component is being destroyed');
	});
</script>
```

* `promise: Promise = tick()`

---

Returns a promise that resolves once any pending state changes have been applied, or in the next microtask if there are none.

```html
<script>
	import { beforeUpdate, tick } from 'svelte';

	beforeUpdate(async () => {
		console.log('the component is about to update');
		await tick();
		console.log('the component just updated');
	});
</script>
```

* `setContext(key: any, context: any)`

---

Associates an arbitrary `context` object with the current component and the specified `key`. The context is then available to children of the component (including slotted content) with `getContext`.

Like lifecycle functions, this must be called during component initialisation.

```html
<script>
	import { setContext } from 'svelte';

	setContext('answer', 42);
</script>
```

* `context: any = getContext(key: any)`

---

Retrieves the context that belongs to the closest parent component with the specified `key`. Must be called during component initialisation.

```html
<script>
	import { getContext } from 'svelte';

	const answer = getContext('answer');
</script>
```



### svelte/store

The `svelte/store` module exports functions for creating [stores](tutorial/writable-stores).

---

To be considered a store, an object must have a `subscribe` method that returns an `unsubscribe` function.

```js
const unsubscribe = store.subscribe(value => {
	console.log(value);
}); // logs `value`

// later...
unsubscribe();
```

---

Stores have special significance inside Svelte components. Their values can be read by prefixing the store's name with the `$` character, which causes Svelte to set up subscriptions and unsubscriptions automatically during the component's lifecycle.

```html
<script>
	import { count } from './stores.js';

	function handleClick() {
		// this is equivalent to count.update(n => n + 1)
		$count += 1;
	}
</script>

<button on:click={handleClick}>
	Clicks: {$count}
</button>
```

* `store = writable(value: any)`
* `store = writable(value: any, () => () => void)`

---

Creates a store with additional `set` and `update` methods.

```js
import { writable } from 'svelte/store';

const count = writable(0);

count.subscribe(value => {
	console.log(value);
}); // logs '0'

count.set(1); // logs '1'

count.update(n => n + 1); // logs '2'
```

---

If a function is passed as the second argument, it will be called when the number of subscribers goes from zero to one (but not from one to two, etc). That function can return another function that is called when the number of subscribers goes from one to zero.

```js
import { writable } from 'svelte/store';

const count = writable(0, () => {
	console.log('got a subscriber');
	return () => console.log('no more subscribers');
});

count.set(1); // does nothing

const unsubscribe = count.subscribe(value => {
	console.log(value);
}); // logs 'got a subscriber', then '1'

unsubscribe(); // logs 'no more subscribers'
```

* `store = readable((set: (value: any) => void) => () => void)`
* `store = readable((set: (value: any) => void) => () => void, value: any)`

---

Creates a store whose value cannot be set from 'outside'. Instead, the function passed to `readable`, which is called when the subscriber count goes from zero to one, must call the provided `set` value. It must return a function that is called when the subscriber count goes from one to zero.

If a second argument is provided, it becomes the store's initial value.

```js
import { readable } from 'svelte/store';

const time = readable(set => {
	const interval = setInterval(() => {
		set(new Date());
	}, 1000);

	return () => clearInterval(interval);
}, new Date());
```

* `store = derive(a, callback: (a: any) => any)`
* `store = derive(a, callback: (a: any, set: (value: any) => void) => void)`
* `store = derive([a, ...b], callback: ([a: any, ...b: any[]]) => any)`
* `store = derive([a, ...b], callback: ([a: any, ...b: any[]], set: (value: any) => void) => void)`

---

Derives a store from one or more other stores. Whenever those dependencies change, the callback runs.

In the simplest version, `derive` takes a single store, and the callback returns a derived value.

```js
import { derive } from 'svelte/store';

const doubled = derive(a, $a => $a * 2);
```

---

The callback can set a value asynchronously by accepting a second argument, `set`, and calling it when appropriate.

```js
import { derive } from 'svelte/store';

const delayed = derive(a, ($a, set) => {
	setTimeout(() => set($a), 1000);
});
```

---

In both cases, an array of arguments can be passed as the first argument instead of a single store.

```js
import { derive } from 'svelte/store';

const summed = derive([a, b], ([$a, $b]) => $a + $b);

const delayed = derive([a, b], ([$a, $b], set) => {
	setTimeout(() => set($a + $b), 1000);
});
```

* `value: any = get(store)`

---

Generally, you should read the value of a store by subscribing to it and using the value as it changes over time. Occasionally, you may need to retrieve the value of a store to which you're not subscribed. `get` allows you to do so.

> This works by creating a subscription, reading the value, then unsubscribing. It's therefore not recommended in hot code paths.

```js
import { get } from 'svelte/store';

const value = get(store);
```


### svelte/motion

The `svelte/motion` module exports two functions, `tweened` and `spring`, for creating writable stores whose values change over time after `set` and `update`, rather than immediately.

#### tweened

* `store = tweened(value: any, options)`

Tweened stores update their values over a fixed duration. The following options are available:

* `delay` (`number`, default 0) — milliseconds before starting
* `duration` (`number`, default 400) — milliseconds the tween lasts
* `easing` (`function`, default `t => t`) — an [easing function](docs#svelte-easing)
* `interpolator` (`function`) — see below

`store.set` and `store.update` can accept a second `options` argument that will override the options passed in upon instantiation.

Both functions return a Promise that resolves when the tween completes. If the tween is interrupted, the promise will never resolve.

---

Out of the box, Svelte will interpolate between two numbers, two arrays or two objects (as long as the arrays and objects are the same 'shape', and their 'leaf' properties are also numbers).

```html
<script>
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	const size = tweened(1, {
		duration: 300,
		easing: cubicOut
	});

	function handleClick() {
		// this is equivalent to size.update(n => n + 1)
		$size += 1;
	}
</script>

<button
	on:click={handleClick}
	style="transform: scale({$size}); transform-origin: 0 0"
>embiggen</button>
```

---

The `interpolator` option allows you to tween between *any* arbitrary values. It must be an `(a, b) => t => value` function, where `a` is the starting value, `b` is the target value, `t` is a number between 0 and 1, and `value` is the result. For example, we can use the [d3-interpolate](https://github.com/d3/d3-interpolate) package to smoothly interpolate between two colours.

```html
<script>
	import { interpolateLab } from 'd3-interpolate';
	import { tweened } from 'svelte/motion';

	const colors = [
		'rgb(255, 62, 0)',
		'rgb(64, 179, 255)',
		'rgb(103, 103, 120)'
	];

	const color = tweened(colors[0], {
		duration: 800,
		interpolate: interpolateLab
	});
</script>

{#each colors as c}
	<button
		style="background-color: {c}; color: white; border: none;"
		on:click="{e => color.set(c)}"
	>{c}</button>
{/each}

<h1 style="color: {$color}">{$color}</h1>
```

#### spring

* `store = spring(value: any, options)`

A `spring` store gradually changes to its target value based on its `stiffness` and `damping` parameters. Whereas `tweened` stores change their values over a fixed duration, `spring` stores change over a duration that is determined by their existing velocity, allowing for more natural-seeming motion in many situations. The following options are available:

* `stiffness` (`number`, default `0.15`) — a value between 0 and 1 where higher means a 'tighter' spring
* `damping` (`number`, default `0.8`) — a value between 0 and 1 where lower means a 'springier' spring
* `precision` (`number`, default `0.001`) — determines the threshold at which the spring is considered to have 'settled', where lower means more precise

---

As with `tweened` stores, `set` and `update` return a Promise that resolves if the spring settles. The `store.stiffness` and `store.damping` properties can be changed while the spring is in motion, and will take immediate effect.

[See a full example here.](tutorial/spring)

```html
<script>
	import { spring } from 'svelte/motion';

	const coords = spring({ x: 50, y: 50 }, {
		stiffness: 0.1,
		damping: 0.25
	});
</script>
```

### svelte/transition

TODO

* fade, fly, slide, draw
* crossfade...

### svelte/animation

TODO

* TODO this doesn't even exist yet

TODO

### svelte/easing

* TODO could have nice little interactive widgets showing the different functions, maybe

### svelte/register

TODO


### Client-side component API

* `const component = new Component(options)`

---

A client-side component — that is, a component compiled with `generate: 'dom'` (or the `generate` option left unspecified) is a JavaScript class.

```js
import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		// assuming App.svelte contains something like
		// `export let answer`:
		answer: 42
	}
});
```

The following initialisation options can be provided:

| option | default | description |
| --- | --- | --- |
| `target` | **none** | An `HTMLElement` to render to. This option is required
| `anchor` | `null` | A child of `target` to render the component immediately before
| `props` | `{}` | An object of properties to supply to the component
| `hydrate` | `false` | See below
| `intro` | `false` | If `true`, will play transitions on initial render, rather than waiting for subsequent state changes

Existing children of `target` are left where they are.


---

The `hydrate` option instructs Svelte to upgrade existing DOM (usually from server-side rendering) rather than creating new elements. It will only work if the component was compiled with the `hydratable: true` option.

Whereas children of `target` are normally left alone, `hydrate: true` will cause any children to be removed. For that reason, the `anchor` option cannot be used alongside `hydrate: true`.

The existing DOM doesn't need to match the component — Svelte will 'repair' the DOM as it goes.

```js
import App from './App.svelte';

const app = new App({
	target: document.querySelector('#server-rendered-html'),
	hydrate: true
});
```

* `component.$set(props)`

---

Programmatically sets props on an instance. `component.$set({ x: 1 })` is equivalent to `x = 1` inside the component's `<script>` block.

Calling this method schedules an update for the next microtask — the DOM is *not* updated synchronously.

```js
app.$set({ answer: 42 });
```

* `component.$on(event, callback)`

---

Causes the `callback` function to be called whenever the component dispatches an `event`.

```js
app.$on('selected', event => {
	console.log(event.detail.selection);
});
```


* `component.$destroy()`

Removes a component from the DOM and triggers any `onDestroy` handlers.


* `component.prop`
* `component.prop = value`

---

If a component is compiled with `accessors: true`, each instance will have getters and setters corresponding to each of the component's props. Setting a value will cause a *synchronous* update, rather than the default async update caused by `component.$set(...)`.

By default, `accessors` is `false`, unless you're compiling as a custom element.

```js
console.log(app.count);
app.count += 1;
```


### Custom element API

* TODO


### Server-side component API

* `const result = Component.render(...)`

---

Unlike client-side components, server-side components don't have a lifespan after you render them — their whole job is to create some HTML and CSS. For that reason, the API is somewhat different.

A server-side component exposes a `render` method that can be called with optional props. It returns an object with `head`, `html`, and `css` properties, where `head` contains the contents of any `<svelte:head>` elements encountered.

```js
const App = require('./App.svelte');

const { head, html, css } = App.render({
	answer: 42
});
```

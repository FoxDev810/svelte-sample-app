<script>
	import Echo from './Echo.svelte';
	import { untrack } from "svelte";

	export let reads = {};

	export let _0 = '0';
	export let _1 = '1';
	export let _2 = '2';

	const read = (value, label) => {
		untrack(() => {
			if (!reads[label]) reads[label] = 0;
			reads[label] += 1;
		});

		return value;
	};

	$: bar = read(_0, '_0') + ':' + read(_1, '_1');
</script>

<Echo
	let:dummy
	d33={_1}
	d32={_2}
>
	<p>{bar}</p>
	<p>{dummy}</p>
	<p>{_0}</p>
	<p>{_1}</p>
	<p>{_2}</p>
</Echo>
<script>
  import {onMount} from 'svelte';
  import Two from './Two.svelte';

  export let snapshot;
  export let foo;

  onMount(() => {
    snapshot = foo();
  });
</script>

<Two bind:foo />

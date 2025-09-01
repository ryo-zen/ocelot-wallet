<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { themeStore } from '$lib/stores/theme.js';
	import { onMount } from 'svelte';
	
	let { children } = $props();

	// Initialize theme on mount
	onMount(() => {
		// Theme store will automatically apply the saved theme from localStorage
		themeStore.subscribe(() => {}); // Just initialize the store
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

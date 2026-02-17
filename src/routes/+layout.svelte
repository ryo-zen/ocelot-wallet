<script lang="ts">
	import '../app.css';
	import { themeStore } from '$lib/stores/theme.js';
	import { onMount } from 'svelte';
	import { initializeMcpEvents } from '$lib/services/mcp-events.js';

	let { children } = $props();

	// Initialize theme and MCP events on mount
	onMount(() => {
		// Theme store will automatically apply the saved theme from localStorage
		themeStore.subscribe(() => {}); // Just initialize the store

		// Initialize MCP event listeners for tauri-plugin-mcp
		initializeMcpEvents();
	});
</script>

<svelte:head>
	<link rel="icon" href="/ocelot-logo.png" />
</svelte:head>

{@render children?.()}

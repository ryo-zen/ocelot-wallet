<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import type { Snippet } from "svelte";

	let {
		value = $bindable(""),
		onValueChange,
		class: className,
		children,
		...restProps
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		class?: string;
		children: Snippet;
		[key: string]: any;
	} = $props();
</script>

<TabsPrimitive.Root bind:value {onValueChange} class={className} {...restProps}>
	{@render children()}
</TabsPrimitive.Root>

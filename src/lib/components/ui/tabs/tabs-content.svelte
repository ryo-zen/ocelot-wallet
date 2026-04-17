<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		class: className,
		value,
		children,
		...restProps
	}: {
		class?: string;
		value: string;
		children: Snippet;
		[key: string]: any;
	} = $props();
</script>

<TabsPrimitive.Content
	{value}
	class={cn(
		"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		className
	)}
	{...restProps}
>
	{@render children()}
</TabsPrimitive.Content>

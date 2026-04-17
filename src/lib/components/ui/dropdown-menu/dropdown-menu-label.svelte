<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		inset?: boolean;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dropdown-menu-label"
	data-inset={inset}
	class={cn("px-2 py-1.5 text-sm font-semibold data-[inset]:pl-8", className)}
	{...restProps}
>
	{@render children?.()}
</div>

<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";

	interface Props {
		hasFilters: boolean;
		onClearFilters: () => void;
	}

	let { hasFilters, onClearFilters }: Props = $props();
</script>

<div class="bg-card border rounded-xl p-8 text-center">
	<h3 class="text-xl font-semibold mb-2">No Transactions Found</h3>
	<p class="text-muted-foreground mb-4">
		{#if hasFilters}
			No transactions match your current filters.
		{:else}
			You haven't made any transactions yet.
		{/if}
	</p>
	{#if hasFilters}
		<Button variant="outline" onclick={onClearFilters}>
			Clear Filters
		</Button>
	{/if}
</div>

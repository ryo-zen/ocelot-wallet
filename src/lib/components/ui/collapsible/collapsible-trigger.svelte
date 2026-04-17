<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";

	let { ref = $bindable(null), ...restProps }: CollapsiblePrimitive.TriggerProps = $props();
</script>

<CollapsiblePrimitive.Trigger bind:ref data-slot="collapsible-trigger" {...restProps} />

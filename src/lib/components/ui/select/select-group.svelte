<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...restProps }: SelectPrimitive.GroupProps = $props();
</script>

<SelectPrimitive.Group data-slot="select-group" {...restProps} />

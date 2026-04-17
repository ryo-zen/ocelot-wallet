<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...restProps }: DialogPrimitive.CloseProps = $props();
</script>

<DialogPrimitive.Close bind:ref data-slot="dialog-close" {...restProps} />

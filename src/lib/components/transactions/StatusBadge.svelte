<script lang="ts">
	import { getStatusBadgeClass } from './transaction-utils.js';

	interface Props {
		status?: string;
	}

	let { status }: Props = $props();
</script>

<span class="px-3 py-1 rounded-full text-xs font-semibold border {getStatusBadgeClass(status)}">
	{(status || 'CONFIRMED').toUpperCase()}
</span>

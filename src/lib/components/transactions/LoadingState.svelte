<script lang="ts">
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
</script>

<div class="space-y-4">
	{#each Array(3) as _}
		<div class="bg-card border rounded-xl p-6">
			<div class="flex justify-between items-start mb-3">
				<Skeleton class="h-5 w-32" />
				<Skeleton class="h-6 w-20 rounded-full" />
			</div>
			<div class="space-y-2">
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-3/4" />
				<Skeleton class="h-4 w-1/2" />
			</div>
		</div>
	{/each}
</div>

<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		total: number;
		limit: number;
		offset: number;
		onPageChange: (newOffset: number) => void;
	}

	let { total, limit, offset, onPageChange }: Props = $props();

	// Calculate pagination info
	const currentPage = $derived(Math.floor(offset / limit) + 1);
	const totalPages = $derived(Math.ceil(total / limit));
	const startItem = $derived(offset + 1);
	const endItem = $derived(Math.min(offset + limit, total));
	const hasPrevious = $derived(offset > 0);
	const hasNext = $derived(offset + limit < total);

	function goToPrevious() {
		if (hasPrevious) {
			onPageChange(Math.max(0, offset - limit));
		}
	}

	function goToNext() {
		if (hasNext) {
			onPageChange(offset + limit);
		}
	}
</script>

<div class="bg-card border rounded-xl p-4">
	<div class="flex items-center justify-between">
		<!-- Page info -->
		<span class="text-sm font-medium text-muted-foreground">
			Showing {startItem}-{endItem} of {total} transactions (Page {currentPage} of {totalPages})
		</span>

		<!-- Navigation buttons -->
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={!hasPrevious}
				onclick={goToPrevious}
			>
				Previous
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={!hasNext}
				onclick={goToNext}
			>
				Next
			</Button>
		</div>
	</div>
</div>

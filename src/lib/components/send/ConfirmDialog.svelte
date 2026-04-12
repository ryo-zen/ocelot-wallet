<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";

	interface Props {
		show: boolean;
		recipient: string;
		amount: string;
		message?: string;
		category?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { show, recipient, amount, message, category, onConfirm, onCancel }: Props = $props();

	function handleBackgroundClick() {
		onCancel();
	}

	function handleDialogClick(e: Event) {
		e.stopPropagation();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onCancel();
		}
	}
</script>

{#if show}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={handleBackgroundClick}
		onkeydown={handleKeyDown}
	>
		<div
			class="bg-card border rounded-xl max-w-lg w-full p-6 space-y-4"
			tabindex="-1"
			role="dialog"
			onclick={handleDialogClick}
			onkeydown={handleKeyDown}
		>
			<div class="text-center">
				<h3 class="text-lg font-bold">Confirm Transaction</h3>
			</div>

			<div class="border rounded-xl p-4 space-y-2">
				<p class="text-xl font-bold">{amount} ZEI</p>
				<div class="space-y-1">
					<span class="text-muted-foreground text-sm">Recipient Address</span>
					<p class="font-mono text-sm break-all">{recipient}</p>
				</div>
				{#if message}
					<div class="space-y-1">
						<span class="text-muted-foreground text-sm">Message</span>
						<p class="text-sm">"{message}"</p>
					</div>
				{/if}
				{#if category}
					<div class="space-y-1">
						<span class="text-muted-foreground text-sm">Category</span>
						<p class="text-sm">{category}</p>
					</div>
				{/if}
			</div>

			<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
				<p class="font-semibold text-center">This action cannot be undone!</p>
				<p class="text-sm text-center">Your message data will be saved and the transaction will be sent immediately.</p>
			</div>

			<div class="flex gap-3">
				<Button
					variant="outline"
					class="flex-1"
					onclick={onCancel}
				>
					Cancel
				</Button>
				<Button
					class="flex-1"
					onclick={onConfirm}
				>
					Confirm & Send
				</Button>
			</div>
		</div>
	</div>
{/if}

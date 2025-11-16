<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import CheckCircle2 from "lucide-svelte/icons/check-circle-2";
	import AlertCircle from "lucide-svelte/icons/alert-circle";
	import Copy from "lucide-svelte/icons/copy";
	import Check from "lucide-svelte/icons/check";

	interface Props {
		recipient: string;
		amount: string;
		message: string;
		category?: string;
		isPrivate: boolean;
		currentBalance: string;
		isLoading: boolean;
		error: string;
		success: string;
		onSend: () => void;
	}

	let {
		recipient = $bindable(),
		amount = $bindable(),
		message = $bindable(),
		category = $bindable(''),
		isPrivate = $bindable(),
		currentBalance,
		isLoading,
		error,
		success,
		onSend
	}: Props = $props();

	const categories = [
		{ value: 'payment', label: 'Payment' },
		{ value: 'donation', label: 'Donation' },
		{ value: 'refund', label: 'Refund' },
		{ value: 'salary', label: 'Salary' },
		{ value: 'invoice', label: 'Invoice' },
		{ value: 'other', label: 'Other' }
	];

	// Derived category display text
	const categoryContent = $derived(
		categories.find((cat) => cat.value === category)?.label ?? "Select category"
	);

	let copied = $state(false);

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	function extractHash(successMessage: string): string {
		const match = successMessage.match(/Hash: ([a-f0-9]+)/i);
		return match ? match[1] : '';
	}
</script>


<Card.Root>
	<Card.Header>
		<Card.Title>Send ZEI</Card.Title>
		<Card.Description>Send ZEI with optional message. Current balance: {currentBalance} ZEI</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		{#if error}
			<Alert.Root variant="destructive">
				<AlertCircle class="h-4 w-4" />
				<Alert.Title>Transaction Failed</Alert.Title>
				<Alert.Description>{error}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if success}
			<Alert.Root class="bg-green-50 border-green-200">
				<CheckCircle2 class="h-4 w-4 text-green-600" />
				<Alert.Title class="text-green-900">Transaction Sent Successfully!</Alert.Title>
				<Alert.Description class="space-y-2">
					<p class="text-green-800">Your transaction has been broadcast to the network.</p>
					<div class="flex items-center gap-2 mt-2">
						<code class="flex-1 bg-green-100 text-green-900 px-3 py-2 rounded text-xs font-mono break-all">
							{extractHash(success)}
						</code>
						<button
							onclick={() => copyToClipboard(extractHash(success))}
							class="p-2 hover:bg-green-200 rounded transition-colors"
							type="button"
							title="Copy transaction hash"
						>
							{#if copied}
								<Check class="h-4 w-4 text-green-700" />
							{:else}
								<Copy class="h-4 w-4 text-green-700" />
							{/if}
						</button>
					</div>
				</Alert.Description>
			</Alert.Root>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="space-y-2">
				<Label for="recipient">Recipient Address *</Label>
				<Input
					id="recipient"
					type="text"
					bind:value={recipient}
					placeholder="tzei1xyz..."
					class="font-mono text-sm"
				/>
			</div>
			<div class="space-y-2">
				<Label for="amount">Amount (ZEI) *</Label>
				<Input
					id="amount"
					type="number"
					bind:value={amount}
					placeholder="1.0"
					step="0.01"
					min="0"
					style="color-scheme: light dark;"
				/>
			</div>
		</div>

		<div class="space-y-2">
			<Label for="message">Message</Label>
			<textarea
				id="message"
				bind:value={message}
				placeholder="Payment for services rendered..."
				class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-vertical min-h-[80px]"
			></textarea>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="space-y-2">
				<Label for="category">Category</Label>
				<Select.Root type="single" name="category" bind:value={category}>
					<Select.Trigger class="w-full">
						{categoryContent}
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							<Select.Label>Transaction Categories</Select.Label>
							{#each categories as cat (cat.value)}
								<Select.Item value={cat.value} label={cat.label}>
									{cat.label}
								</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<div class="flex items-center space-x-2">
			<input
				type="checkbox"
				id="isPrivate"
				bind:checked={isPrivate}
				class="rounded"
			/>
			<Label for="isPrivate" class="font-normal cursor-pointer">Mark as Private</Label>
		</div>
	</Card.Content>
	<Card.Footer>
		<button
			onclick={onSend}
			type="button"
			class="w-full h-9 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
			disabled={isLoading}
		>
			{#if isLoading}
				Sending...
			{:else}
				Send Transaction
			{/if}
		</button>
	</Card.Footer>
</Card.Root>

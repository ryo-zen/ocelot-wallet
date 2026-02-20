<script lang="ts">
	import StatusBadge from './StatusBadge.svelte';
	import { formatAmount, formatDate, type Transaction } from './transaction-utils.js';

	interface Props {
		transaction: Transaction;
		currentAddress: string;
	}

	let { transaction, currentAddress }: Props = $props();
</script>

<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
	<div class="flex justify-between items-start mb-4">
		<div class="space-y-1">
			<h3 class="text-lg font-bold">
				Block #{transaction.block_height || 'Pending'}
			</h3>
			<p class="text-muted-foreground font-medium">
				{transaction.sender === currentAddress ? 'Sent' : 'Received'} {formatAmount(transaction.amount)} ZEI
			</p>
		</div>
		<StatusBadge status={transaction.status} />
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div class="space-y-4">
			<div class="space-y-1">
				<span class="text-muted-foreground font-medium text-sm">Recipient</span>
				<p class="font-mono text-sm break-all">{transaction.recipient}</p>
			</div>
			<div class="space-y-1">
				<span class="text-muted-foreground font-medium text-sm">Block Height</span>
				<p class="font-mono">{transaction.block_height || 'Pending'}</p>
			</div>
			<div class="space-y-1">
				<span class="text-muted-foreground font-medium text-sm">Confirmations</span>
				<p class="font-mono">{transaction.confirmations || 0}</p>
			</div>
		</div>
		<div class="space-y-4">
			<div class="space-y-1">
				<span class="text-muted-foreground font-medium text-sm">Network Fee</span>
				<p class="font-mono">{formatAmount(transaction.fee || 5000)} ZEI</p>
			</div>
			<div class="space-y-1">
				<span class="text-muted-foreground font-medium text-sm">Timestamp</span>
				<p class="font-mono text-sm">{formatDate(transaction.timestamp || transaction.created_at)}</p>
			</div>
			<div class="space-y-1">
				<span class="text-muted-foreground font-medium text-sm">Hash</span>
				<p class="font-mono text-sm break-all">{transaction.hash || transaction.tx_hash || 'Pending'}</p>
			</div>
		</div>
	</div>

	{#if transaction.message || transaction.category}
		<div class="mt-6 pt-4 border-t border-border">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#if transaction.message}
					<div class="space-y-1">
						<span class="text-muted-foreground font-medium text-sm">Message</span>
						<p class="text-sm italic border-l-2 border-muted-foreground/30 pl-2">{transaction.message}</p>
					</div>
				{/if}
				{#if transaction.category}
					<div class="space-y-1">
						<span class="text-muted-foreground font-medium text-sm">Category</span>
						<p class="text-sm font-medium capitalize">{transaction.category}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

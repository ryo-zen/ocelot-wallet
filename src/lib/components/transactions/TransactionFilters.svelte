<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import * as Select from "$lib/components/ui/select/index.js";

	interface Props {
		statusFilter: string[];
		messageSearch: string;
		isLoading: boolean;
		isAuthenticated: boolean;
		onLoadTransactions: () => void;
		onClearFilters: () => void;
		onStatusFilterChange: (value: string[]) => void;
		onMessageSearchChange: (value: string) => void;
	}

	let {
		statusFilter,
		messageSearch,
		isLoading,
		isAuthenticated,
		onLoadTransactions,
		onClearFilters,
		onStatusFilterChange,
		onMessageSearchChange
	}: Props = $props();
</script>

<div class="bg-card border rounded-xl p-6">
	<h2 class="text-2xl font-bold mb-4">Transaction History</h2>

	<div class="grid grid-cols-1 md:grid-cols-[auto_auto_1fr] md:items-end gap-x-8 gap-y-1 mb-4">
		<div class="space-y-4">
			<label for="status-filter" class="text-sm font-medium block mb-2">Filter by Status</label>
			<Select.Root
				type="multiple"
				value={statusFilter}
				onValueChange={onStatusFilterChange}
			>
				<Select.Trigger id="status-filter">
					{statusFilter.length > 0 ? statusFilter.join(', ') : 'All Statuses'}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						<Select.Item value="">All Statuses</Select.Item>
						<Select.Item value="confirmed">Confirmed</Select.Item>
						<Select.Item value="pending">Pending</Select.Item>
						<Select.Item value="draft">Draft</Select.Item>
						<Select.Item value="failed">Failed</Select.Item>
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>

		<div class="space-y-4">
			<label for="message-search" class="text-sm font-medium block mb-2">Search Messages</label>
			<Input
				id="message-search"
				value={messageSearch}
				oninput={(e) => onMessageSearchChange((e.target as HTMLInputElement).value)}
				placeholder="Search in message content..."
				class="w-full md:w-80"
			/>
		</div>

		<div>
			<div class="flex items-center justify-start md:justify-end gap-2">
				<Button onclick={onLoadTransactions} disabled={isLoading || !isAuthenticated}>
					{#if isLoading}
						Loading...
					{:else if !isAuthenticated}
						Login Required
					{:else}
						Load Transactions
					{/if}
				</Button>
				<Button variant="outline" onclick={onClearFilters}>
					Clear Filters
				</Button>
			</div>
		</div>
	</div>
</div>

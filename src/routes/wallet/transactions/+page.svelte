<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import { authStore } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface Transaction {
		id?: string;
		hash?: string;
		tx_hash?: string;
		block_height?: number;
		amount: number;
		fee?: number;
		recipient: string;
		sender?: string;
		status: 'confirmed' | 'pending' | 'failed' | 'draft';
		timestamp?: string;
		message?: string;
		category?: string;
		tags?: string[];
		reference_id?: string;
		confirmations?: number;
	}

	let transactions: Transaction[] = [];
	let isLoading = false;
	let errorMessage = '';
	let statusFilter: string[] = [];
	let messageSearch = '';
	let isAuthenticated = false;
	let currentWallet = '';
	let currentAddress = '';

	// Subscribe to auth store
	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
		currentWallet = state.wallet || '';
	});

	function getStatusBadgeClass(status?: string): string {
		switch (status?.toLowerCase()) {
			case 'confirmed':
				return 'bg-transparent text-foreground border-primary';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'failed':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'draft':
				return 'bg-gray-100 text-gray-800 border-gray-200';
			default:
				return 'bg-transparent text-foreground border-primary'; // Default to confirmed for transactions
		}
	}

	function formatAmount(amount: number): string {
		return (amount / 100000000).toFixed(8);
	}

	function formatDate(timestamp?: string): string {
		if (!timestamp) return 'Unknown Time';
		try {
			return new Date(timestamp).toLocaleString('en-GB', {
				timeZone: 'UTC',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}) + ' UTC';
		} catch {
			return 'Invalid Date';
		}
	}

	async function loadTransactions() {
		if (!isAuthenticated) {
			errorMessage = 'Please login to view transactions';
			return;
		}

		isLoading = true;
		errorMessage = '';
		transactions = [];

		try {
			const { wallet, password } = authStore.getCredentials();
			if (!wallet || !password) {
				throw new Error('Authentication expired');
			}

			// Get user's address first
			let userAddress = wallet;
			currentAddress = userAddress;
			try {
				const addressResponse = await fetch('http://127.0.0.1:8081/ws', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						command: 'address',
						wallet: wallet,
						password: password
					})
				});
				
				if (addressResponse.ok) {
					const addressResult = await addressResponse.json();
					if (addressResult.success && addressResult.address) {
						userAddress = addressResult.address;
						currentAddress = userAddress;
					}
				}
			} catch (e) {
				console.log('Could not get user address, using wallet name');
			}

			// API filtering is completely broken, so fetch all and filter client-side
			
			const response = await fetch('http://localhost:8080/api/transactions/enhanced');
			const result = await response.json();

			if (response.ok && result.transactions) {
				// Filter client-side for transactions where user is sender OR recipient
				let filteredTransactions = result.transactions.filter((tx: Transaction) => 
					tx.sender === userAddress || tx.recipient === userAddress
				);

				// Apply status filter
				if (statusFilter.length > 0) {
					filteredTransactions = filteredTransactions.filter((tx: Transaction) => 
						statusFilter.includes((tx.status || 'confirmed').toLowerCase())
					);
				}

				// Apply message search
				if (messageSearch) {
					filteredTransactions = filteredTransactions.filter((tx: Transaction) => 
						tx.message?.toLowerCase().includes(messageSearch.toLowerCase()) || false
					);
				}

				// Sort by block height (newest first)
				transactions = filteredTransactions.sort((a: Transaction, b: Transaction) => (b.block_height || 0) - (a.block_height || 0));
			} else {
				errorMessage = result.error || 'Failed to load transactions';
			}

			// Refresh session on successful API call
			authStore.refreshSession();
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('Authentication expired')) {
					authStore.logout();
					goto('/login-02');
					return;
				} else if (error.message.includes('Failed to fetch')) {
					errorMessage = 'Unable to connect to transaction service';
				} else {
					errorMessage = error.message;
				}
			} else {
				errorMessage = 'An unexpected error occurred';
			}
		} finally {
			isLoading = false;
		}
	}

	function clearFilters() {
		statusFilter = [];
		messageSearch = '';
		transactions = [];
		errorMessage = '';
	}

	onMount(() => {
		if (!isAuthenticated) {
			goto('/login-02');
			return;
		}
		loadTransactions();
	});
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header
			class="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear"
		>
			<div class="flex items-center gap-2 px-4">
				<Sidebar.Trigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item>
							<Breadcrumb.Link href="/wallet">Wallet</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator />
						<Breadcrumb.Item>
							<Breadcrumb.Page>Transactions</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<!-- Filters Section -->
			<div class="bg-card border rounded-xl p-6">
				<h2 class="text-2xl font-bold mb-4">Transaction History</h2>
				
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
					<div class="space-y-2">
						<label for="status-filter" class="text-sm font-medium">Filter by Status</label>
						<Select.Root type="multiple" value={statusFilter} onValueChange={(value: string[]) => statusFilter = value}>
							<Select.Trigger id="status-filter">
								{statusFilter.length > 0 ? statusFilter.join(', ') : 'All Statuses'}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value={""}>All Statuses</Select.Item>
									<Select.Item value={"confirmed"}>Confirmed</Select.Item>
									<Select.Item value={"pending"}>Pending</Select.Item>
									<Select.Item value={"draft"}>Draft</Select.Item>
									<Select.Item value={"failed"}>Failed</Select.Item>
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
					
					<div class="space-y-2">
						<label for="message-search" class="text-sm font-medium">Search Messages</label>
						<Input 
							id="message-search"
							bind:value={messageSearch} 
							placeholder="Search in message content..."
						/>
					</div>
					
					<div class="flex items-end gap-2">
						<Button onclick={loadTransactions} disabled={isLoading || !isAuthenticated}>
							{#if isLoading}
								Loading...
							{:else if !isAuthenticated}
								Login Required
							{:else}
								Load Transactions
							{/if}
						</Button>
						<Button variant="outline" onclick={clearFilters}>
							Clear Filters
						</Button>
					</div>
				</div>
			</div>

			<!-- Status Messages -->
			{#if errorMessage}
				<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium">
					{errorMessage}
				</div>
			{/if}

			<!-- Loading Skeletons -->
			{#if isLoading}
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
			{/if}

			<!-- Transactions List -->
			{#if !isLoading && transactions.length > 0}
				<div class="space-y-4">
					{#each transactions as tx}
						<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
							<div class="flex justify-between items-start mb-4">
								<div class="space-y-1">
									<h3 class="text-lg font-bold">
										Block #{tx.block_height || 'Pending'}
									</h3>
									<p class="text-muted-foreground font-medium">
										{tx.sender === currentAddress ? 'Sent' : 'Received'} {formatAmount(tx.amount)} ZEI
									</p>
								</div>
								<span class="px-3 py-1 rounded-full text-xs font-semibold border {getStatusBadgeClass(tx.status)}">
									{(tx.status || 'CONFIRMED').toUpperCase()}
								</span>
							</div>
							
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div class="space-y-4">
									<div class="space-y-1">
										<span class="text-muted-foreground font-medium text-sm">Recipient</span>
										<p class="font-mono text-sm break-all">{tx.recipient}</p>
									</div>
									<div class="space-y-1">
										<span class="text-muted-foreground font-medium text-sm">Block Height</span>
										<p class="font-mono">{tx.block_height || 'Pending'}</p>
									</div>
									<div class="space-y-1">
										<span class="text-muted-foreground font-medium text-sm">Confirmations</span>
										<p class="font-mono">{tx.confirmations || 0}</p>
									</div>
								</div>
								<div class="space-y-4">
									<div class="space-y-1">
										<span class="text-muted-foreground font-medium text-sm">Network Fee</span>
										<p class="font-mono">{formatAmount(tx.fee || 5000)} ZEI</p>
									</div>
									<div class="space-y-1">
										<span class="text-muted-foreground font-medium text-sm">Timestamp</span>
										<p class="font-mono text-sm">{formatDate(tx.timestamp)}</p>
									</div>
									<div class="space-y-1">
										<span class="text-muted-foreground font-medium text-sm">Hash</span>
										<p class="font-mono text-sm break-all">{tx.hash || tx.tx_hash || 'Pending'}</p>
									</div>
								</div>
							</div>
							
							{#if tx.message || tx.category || tx.reference_id || (tx.tags && tx.tags.length > 0)}
								<div class="mt-6 pt-4 border-t border-border">
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										{#if tx.message}
											<div class="space-y-1">
												<span class="text-muted-foreground font-medium text-sm">Message</span>
												<p class="text-sm font-medium">"{tx.message}"</p>
											</div>
										{/if}
										{#if tx.category}
											<div class="space-y-1">
												<span class="text-muted-foreground font-medium text-sm">Category</span>
												<p class="text-sm font-medium capitalize">{tx.category}</p>
											</div>
										{/if}
										{#if tx.reference_id}
											<div class="space-y-1">
												<span class="text-muted-foreground font-medium text-sm">Reference ID</span>
												<p class="text-sm font-mono">{tx.reference_id}</p>
											</div>
										{/if}
										{#if tx.tags && tx.tags.length > 0}
											<div class="space-y-1">
												<span class="text-muted-foreground font-medium text-sm">Tags</span>
												<div class="flex flex-wrap gap-1">
													{#each tx.tags as tag}
														<span class="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs font-medium">{tag}</span>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else if !isLoading && !errorMessage}
				<div class="bg-card border rounded-xl p-8 text-center">
					<h3 class="text-xl font-semibold mb-2">No Transactions Found</h3>
					<p class="text-muted-foreground mb-4">
						{#if statusFilter.length > 0 || messageSearch}
							No transactions match your current filters.
						{:else}
							You haven't made any transactions yet.
						{/if}
					</p>
					{#if statusFilter.length > 0 || messageSearch}
						<Button variant="outline" onclick={clearFilters}>
							Clear Filters
						</Button>
					{/if}
				</div>
			{/if}

			{#if !isLoading && transactions.length > 0}
				<div class="bg-muted border rounded-xl p-4">
					<div class="flex items-center justify-center">
						<span class="text-sm font-medium text-muted-foreground">
							Found {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} for {currentWallet}
						</span>
					</div>
				</div>
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
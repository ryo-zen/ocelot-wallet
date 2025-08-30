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
	let statusFilter = '';
	let messageSearch = '';
	let isAuthenticated = false;
	let currentWallet = '';

	// Subscribe to auth store
	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
		currentWallet = state.wallet || '';
	});

	function getStatusBadgeClass(status?: string): string {
		switch (status?.toLowerCase()) {
			case 'confirmed':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'failed':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'draft':
				return 'bg-gray-100 text-gray-800 border-gray-200';
			default:
				return 'bg-green-100 text-green-800 border-green-200'; // Default to confirmed for transactions
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
					}
				}
			} catch (e) {
				console.log('Could not get user address, using wallet name');
			}

			// Build API URL with filters
			let apiUrl = `http://localhost:8080/api/transactions/enhanced?sender=${encodeURIComponent(userAddress)}`;
			if (statusFilter) {
				apiUrl += `&status=${encodeURIComponent(statusFilter)}`;
			}
			if (messageSearch) {
				apiUrl += `&search=${encodeURIComponent(messageSearch)}`;
			}

			const response = await fetch(apiUrl);
			const result = await response.json();

			if (response.ok && result.transactions) {
				transactions = result.transactions;
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
		statusFilter = '';
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
				<h2 class="text-2xl font-bold mb-4">📋 Transaction History</h2>
				
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
					<div class="space-y-2">
						<label class="text-sm font-medium">Filter by Status</label>
						<Select.Root bind:value={statusFilter}>
							<Select.Trigger>
								{statusFilter || 'All Statuses'}
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
					
					<div class="space-y-2">
						<label class="text-sm font-medium">Search Messages</label>
						<Input 
							bind:value={messageSearch} 
							placeholder="Search in message content..."
						/>
					</div>
					
					<div class="flex items-end gap-2">
						<Button on:click={loadTransactions} disabled={isLoading || !isAuthenticated}>
							{#if isLoading}
								Loading...
							{:else if !isAuthenticated}
								🔐 Login Required
							{:else}
								Load Transactions
							{/if}
						</Button>
						<Button variant="outline" on:click={clearFilters}>
							Clear Filters
						</Button>
					</div>
				</div>
			</div>

			<!-- Status Messages -->
			{#if errorMessage}
				<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
					❌ {errorMessage}
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
							<div class="flex justify-between items-start mb-3">
								<div class="flex items-center gap-2">
									<h3 class="font-mono text-lg font-bold">
										#{tx.block_height || 'Pending'} 📤 SENT {formatAmount(tx.amount)} ZEI
									</h3>
								</div>
								<span class="px-2 py-1 rounded-full text-xs font-medium border {getStatusBadgeClass(tx.status)}">
									{(tx.status || 'CONFIRMED').toUpperCase()}
								</span>
							</div>
							
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
								<div class="space-y-1">
									<div class="text-white">🎯 <span class="font-medium">To:</span> {tx.recipient}</div>
									<div class="text-white">🔗 <span class="font-medium">Block:</span> {tx.block_height || 'Pending'}</div>
									<div class="text-white">✅ <span class="font-medium">Confirmations:</span> {tx.confirmations || 0}</div>
								</div>
								<div class="space-y-1">
									<div class="text-white">💰 <span class="font-medium">Fee:</span> {formatAmount(tx.fee || 5000)} ZEI</div>
									<div class="text-white">⏰ <span class="font-medium">Time:</span> {formatDate(tx.timestamp)}</div>
									<div class="text-white break-all">🆔 <span class="font-medium">Hash:</span> {tx.hash || tx.tx_hash || 'Pending'}</div>
								</div>
							</div>
							
							{#if tx.message || tx.category || tx.reference_id || (tx.tags && tx.tags.length > 0)}
								<div class="mt-4 pt-4 border-t border-gray-100">
									<h4 class="font-medium text-sm mb-2">📝 Enhanced Data</h4>
									<div class="space-y-1 text-sm">
										{#if tx.message}
											<div class="text-white">💬 <span class="font-medium">Message:</span> "{tx.message}"</div>
										{/if}
										{#if tx.category}
											<div class="text-white">🏷️ <span class="font-medium">Category:</span> {tx.category}</div>
										{/if}
										{#if tx.reference_id}
											<div class="text-white">🔗 <span class="font-medium">Reference:</span> {tx.reference_id}</div>
										{/if}
										{#if tx.tags && tx.tags.length > 0}
											<div class="text-white">
												🏷️ <span class="font-medium">Tags:</span> 
												<span class="inline-flex gap-1 ml-1">
													{#each tx.tags as tag}
														<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{tag}</span>
													{/each}
												</span>
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
					<div class="text-6xl mb-4">📭</div>
					<h3 class="text-xl font-semibold mb-2">No Transactions Found</h3>
					<p class="text-white mb-4">
						{#if statusFilter || messageSearch}
							No transactions match your current filters.
						{:else}
							You haven't made any enhanced transactions yet.
						{/if}
					</p>
					{#if statusFilter || messageSearch}
						<Button variant="outline" on:click={clearFilters}>
							Clear Filters
						</Button>
					{/if}
				</div>
			{/if}

			{#if !isLoading && transactions.length > 0}
				<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
					<div class="flex items-center gap-2 text-blue-800">
						<span class="text-sm font-medium">📊 Found {transactions.length} enhanced transaction{transactions.length !== 1 ? 's' : ''} for {currentWallet}</span>
					</div>
				</div>
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
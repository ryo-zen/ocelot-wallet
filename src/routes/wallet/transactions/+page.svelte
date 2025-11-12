<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { authStore } from '$lib/stores/auth.js';
	import { serverConfigStore } from '$lib/stores/server-config.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';

	// Transaction components
	import TransactionFilters from '$lib/components/transactions/TransactionFilters.svelte';
	import TransactionCard from '$lib/components/transactions/TransactionCard.svelte';
	import EmptyState from '$lib/components/transactions/EmptyState.svelte';
	import LoadingState from '$lib/components/transactions/LoadingState.svelte';
	import Pagination from '$lib/components/transactions/Pagination.svelte';
	import { filterTransactions, type Transaction } from '$lib/components/transactions/transaction-utils.js';

	let transactions: Transaction[] = $state([]);
	let filteredTransactions: Transaction[] = $state([]);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let statusFilter: string[] = $state([]);
	let messageSearch = $state('');
	let isAuthenticated = $state(false);
	let currentWallet = $state('');
	let currentAddress = $state('');

	// Pagination state
	let total = $state(0);
	let limit = $state(50);
	let offset = $state(0);

	// Subscribe to auth store
	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
		currentWallet = state.wallet || '';
		currentAddress = state.address || '';
	});

	// Apply filters reactively
	$effect(() => {
		filteredTransactions = filterTransactions(transactions, statusFilter, messageSearch);
	});

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

			// Get user's address from auth store (set during login)
			const storeState = get(authStore);
			const userAddress = storeState.address;

			if (!userAddress) {
				throw new Error('Wallet address not found in session');
			}

			currentAddress = userAddress;

			// Get API URL from server config
			const apiUrl = serverConfigStore.getCurrentServerUrl();

			// Fetch transactions via Tauri API
			const { tauriWalletAPI } = await import('$lib/services/tauri-wallet-api.js');
			const response = await tauriWalletAPI.getTransactions(userAddress, limit, offset, apiUrl);

			if (tauriWalletAPI.isSuccess(response)) {
				const data = tauriWalletAPI.unwrap(response);
				const result = JSON.parse(data.transactions_json);

				if (result.transactions) {
					transactions = result.transactions;
					total = result.transactions.length || 0;

					// Debug: Log first transaction to see structure
					if (transactions.length > 0) {
						console.log('Transaction data:', transactions[0]);
					}
				} else {
					errorMessage = 'No transactions found';
				}
			} else {
				errorMessage = response.error || 'Failed to load transactions';
			}

			// Refresh session
			authStore.refreshSession();
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('Authentication expired')) {
					authStore.logout();
					goto('/login');
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

	function handlePageChange(newOffset: number) {
		offset = newOffset;
		loadTransactions();
	}

	onMount(() => {
		if (!isAuthenticated) {
			goto('/login');
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
			<!-- Filters -->
			<TransactionFilters
				{statusFilter}
				{messageSearch}
				{isLoading}
				{isAuthenticated}
				onLoadTransactions={loadTransactions}
				onClearFilters={clearFilters}
				onStatusFilterChange={(value) => statusFilter = value}
				onMessageSearchChange={(value) => messageSearch = value}
			/>

			<!-- Error Message -->
			{#if errorMessage}
				<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium">
					{errorMessage}
				</div>
			{/if}

			<!-- Loading State -->
			{#if isLoading}
				<LoadingState />
			{/if}

			<!-- Transactions List -->
			{#if !isLoading && filteredTransactions.length > 0}
				<div class="space-y-4">
					{#each filteredTransactions as transaction}
						<TransactionCard {transaction} {currentAddress} />
					{/each}
				</div>
			{:else if !isLoading && !errorMessage}
				<EmptyState
					hasFilters={statusFilter.length > 0 || messageSearch.length > 0}
					onClearFilters={clearFilters}
				/>
			{/if}

			<!-- Pagination -->
			{#if !isLoading && total > 0}
				<Pagination
					{total}
					{limit}
					{offset}
					onPageChange={handlePageChange}
				/>
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

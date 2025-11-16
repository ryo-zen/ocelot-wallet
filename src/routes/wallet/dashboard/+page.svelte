<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/stores/auth.js';
	import { tauriWalletAPI } from '$lib/services/tauri-wallet-api.js';
	import { serverConfigStore } from '$lib/stores/server-config.js';

	let currentWallet = $state('');
	let currentBalance = $state('');
	let walletAddress = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let isNewWallet = $state(false);

	async function fetchBalance() {
		errorMessage = '';

		// First, try to refresh the session
		const sessionRefreshed = authStore.refreshSession();
		if (!sessionRefreshed) {
			errorMessage = 'Session expired - please log in again';
			setTimeout(() => {
				window.location.href = '/login';
			}, 3000);
			return;
		}

		// Get credentials after refreshing session
		const authState = authStore.getCredentials();
		if (!authState.isAuthenticated || !authState.wallet) {
			errorMessage = 'Authentication required - please log in again';
			setTimeout(() => {
				window.location.href = '/login';
			}, 3000);
			return;
		}

		isLoading = true;

		try {
			// Get wallet address from auth store (stored during login)
			const storeState = get(authStore);
			const address = storeState.address;

			if (!address) {
				throw new Error('Wallet address not found in session');
			}

			// Get RPC URL from server config
			const rpcUrl = serverConfigStore.getCurrentRpcUrl();

			// Fetch balance via Tauri
			const response = await tauriWalletAPI.getBalance(address, rpcUrl);

			if (tauriWalletAPI.isSuccess(response)) {
				const data = tauriWalletAPI.unwrap(response);

				// Convert from base units to ZEI (1 ZEI = 100,000,000 base units, like Bitcoin satoshis)
				const balanceNum = parseFloat(data.balance) / 100_000_000;
				const formattedBalance = balanceNum.toLocaleString('en-US', {
					minimumFractionDigits: 2,
					maximumFractionDigits: 8
				});

				currentWallet = authState.wallet;
				currentBalance = formattedBalance;
				walletAddress = address;
				errorMessage = '';

				// Check if this is a new wallet (zero balance)
				isNewWallet = balanceNum === 0;
			} else {
				errorMessage = response.error || 'Failed to fetch balance';
				currentBalance = 'Error';
				isNewWallet = false;
			}

		} catch (error) {
			console.error('Balance fetch error:', error);
			const err = error instanceof Error ? error.message : String(error);
			errorMessage = `Failed to fetch balance: ${err}`;
			currentBalance = 'Error';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		console.log('Dashboard onMount - calling fetchBalance');
		fetchBalance();
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
							<Breadcrumb.Page>Dashboard</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<!-- Wallet Info Card -->
			<div class="bg-card border rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-2xl font-bold">Wallet Dashboard</h2>
					<Button variant="outline" size="sm" onclick={fetchBalance} disabled={isLoading}>
						{#if isLoading}
							Refreshing...
						{:else}
							Refresh
						{/if}
					</Button>
				</div>

				{#if errorMessage}
					<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium mb-4">
						{errorMessage}
					</div>
				{/if}

				{#if isNewWallet && !errorMessage}
					<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
						<h3 class="font-semibold text-blue-800 mb-2">New Wallet</h3>
						<p class="text-sm text-blue-700">
							This wallet has a zero balance. To get started, send ZEI to your wallet address below.
						</p>
					</div>
				{/if}

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div class="space-y-4">
						<div class="space-y-1">
							<span class="text-sm font-medium text-muted-foreground">Current Wallet</span>
							<p class="text-xl font-bold text-primary">{currentWallet || 'Not logged in'}</p>
						</div>
						<div class="space-y-1">
							<span class="text-sm font-medium text-muted-foreground">Wallet Address</span>
							<p class="font-mono text-sm break-all">{walletAddress || 'Not available'}</p>
						</div>
					</div>
					<div class="space-y-1 text-right">
						<span class="text-sm font-medium text-muted-foreground">Balance</span>
						<p class="text-xl font-bold text-primary">
							{#if isLoading}
								Loading...
							{:else}
								{currentBalance} ZEI
							{/if}
						</p>
					</div>
				</div>
			</div>

			<div class="grid gap-6 md:grid-cols-3">
				<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
					<div class="space-y-1 mb-4">
						<h3 class="text-lg font-bold">Recent Transactions</h3>
						<p class="text-muted-foreground font-medium">Latest activity</p>
					</div>
					<div class="text-center py-8">
						<span class="text-muted-foreground">No recent transactions</span>
					</div>
				</div>
				<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
					<div class="space-y-1 mb-4">
						<h3 class="text-lg font-bold">Quick Actions</h3>
						<p class="text-muted-foreground font-medium">Common tasks</p>
					</div>
					<div class="space-y-2">
						<Button class="w-full" onclick={() => window.location.href = '/wallet/send'}>Send ZEI</Button>
						<Button variant="outline" class="w-full" onclick={() => window.location.href = '/wallet/transactions'}>View Transactions</Button>
					</div>
				</div>
				<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
					<div class="space-y-1 mb-4">
						<h3 class="text-lg font-bold">L2 Messages</h3>
						<p class="text-muted-foreground font-medium">Enhanced messaging</p>
					</div>
					<div class="text-center py-8">
						<span class="text-muted-foreground">Feature coming soon</span>
					</div>
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

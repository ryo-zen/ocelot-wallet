<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.js';
	import { databaseService } from '$lib/services/database.js';

	let currentWallet = $state('');
	let currentBalance = $state('');
	let walletAddress = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	async function fetchBalance() {
		isLoading = true;
		errorMessage = '';
		
		// First, try to refresh the session
		const sessionRefreshed = authStore.refreshSession();
		if (!sessionRefreshed) {
			errorMessage = 'Session expired - please log in again';
			isLoading = false;
			setTimeout(() => {
				window.location.href = '/login-02';
			}, 3000);
			return;
		}
		
		// Get credentials after refreshing session
		const authState = authStore.getCredentials();
		if (!authState.isAuthenticated || !authState.wallet) {
			errorMessage = 'Authentication required - please log in again';
			isLoading = false;
			setTimeout(() => {
				window.location.href = '/login-02';
			}, 3000);
			return;
		}
		
		try {
			// Use database service for both address lookup and balance query
			const result = await databaseService.getWalletBalance(authState.wallet);
			
			// Format balance with proper decimal places for ZEI
			currentBalance = result.balance.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 8
			});
			
			currentWallet = authState.wallet;
			walletAddress = result.address;
			// Clear any previous error messages on success
			errorMessage = '';
			
		} catch (error) {
			console.error('Balance fetch error:', error);
			if (error instanceof Error) {
				errorMessage = error.message;
				currentBalance = 'Error';
			} else {
				errorMessage = 'Failed to fetch balance from database';
				currentBalance = 'Error';
			}
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
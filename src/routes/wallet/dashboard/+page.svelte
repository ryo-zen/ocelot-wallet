<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.js';

	let currentWallet = $state('');
	let currentBalance = $state('');
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
		if (!authState.isAuthenticated || !authState.wallet || !authState.password) {
			errorMessage = 'Authentication required - please log in again';
			isLoading = false;
			setTimeout(() => {
				window.location.href = '/login-02';
			}, 3000);
			return;
		}
		
		try {
			const response = await fetch('http://127.0.0.1:8081/ws', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					command: 'balance',
					wallet: authState.wallet,
					password: authState.password
				})
			});

			if (!response.ok) {
				const responseText = await response.text();
				throw new Error(`HTTP ${response.status}: ${responseText}`);
			}
			
			const result = await response.json();
			
			if (result.error) {
				throw new Error(result.error);
			}
			
			if (result.success) {
				currentBalance = result.balance || 'Unknown';
				currentWallet = authState.wallet;
			} else {
				throw new Error(`Balance command failed: ${JSON.stringify(result)}`);
			}
		} catch (error) {
			console.error('Balance fetch error:', error);
			errorMessage = error instanceof Error ? error.message : 'Failed to fetch balance';
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
					<div class="space-y-1">
						<span class="text-sm font-medium text-muted-foreground">Current Wallet</span>
						<p class="text-xl font-bold text-primary">{currentWallet || 'Not logged in'}</p>
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
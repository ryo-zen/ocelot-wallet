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
		const authState = authStore.getCredentials();
		
		if (!authState.isAuthenticated || !authState.wallet || !authState.password) {
			errorMessage = 'Session expired - please log in again';
			// Auto-redirect to login if not authenticated
			setTimeout(() => {
				window.location.href = '/login-02';
			}, 2000);
			return;
		}
		
		isLoading = true;
		errorMessage = '';
		
		try {
			// Refresh session on API activity
			authStore.refreshSession();
			
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
	
	function handleLogout() {
		authStore.logout();
		window.location.href = '/login-02';
	}

	onMount(() => {
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
						<Breadcrumb.Item class="hidden md:block">
							<Breadcrumb.Link href="#">Building Your Application</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator class="hidden md:block" />
						<Breadcrumb.Item>
							<Breadcrumb.Page>Data Fetching</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<!-- Wallet Info Card -->
			<div class="bg-card border rounded-xl p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-2xl font-bold">💰 Wallet Information</h2>
					<Button variant="outline" size="sm" onclick={fetchBalance} disabled={isLoading}>
						{#if isLoading}
							Refreshing...
						{:else}
							🔄 Refresh
						{/if}
					</Button>
				</div>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<span class="text-sm font-medium text-muted-foreground">Current Wallet</span>
						<div class="text-xl font-bold text-primary">{currentWallet || 'Not logged in'}</div>
					</div>
					<div class="text-right">
						<span class="text-sm font-medium text-muted-foreground">Balance</span>
						<div class="text-xl font-bold text-green-600">
							{#if isLoading}
								Loading...
							{:else if errorMessage}
								<span class="text-red-500">Error: {errorMessage}</span>
							{:else}
								{currentBalance} ZEI
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="grid auto-rows-min gap-4 md:grid-cols-3">
				<div class="bg-muted/50 aspect-video rounded-xl"></div>
				<div class="bg-muted/50 aspect-video rounded-xl"></div>
				<div class="bg-muted/50 aspect-video rounded-xl"></div>
			</div>
			<div class="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min"></div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

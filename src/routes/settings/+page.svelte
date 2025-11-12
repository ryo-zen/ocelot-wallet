<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { authStore } from '$lib/stores/auth.js';
	import { serverConfigStore, availableServers } from '$lib/stores/server-config.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Settings2Icon from "@lucide/svelte/icons/settings-2";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import ServerIcon from "@lucide/svelte/icons/server";
	import CheckIcon from "@lucide/svelte/icons/check";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";

	let isAuthenticated = false;
	let selectedServerId = $state('sydney-production');
	let currentServerUrl = $state('');
	let currentRpcUrl = $state('');
	let saveMessage = $state('');
	let apiStatus = $state<'checking' | 'online' | 'offline'>('checking');
	let rpcStatus = $state<'checking' | 'online' | 'offline'>('checking');

	// Subscribe to auth store
	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
	});

	// Subscribe to server config store
	serverConfigStore.subscribe(state => {
		selectedServerId = state.selectedServerId;
		currentServerUrl = serverConfigStore.getCurrentServerUrl();
		currentRpcUrl = serverConfigStore.getCurrentRpcUrl();
	});

	onMount(() => {
		if (!isAuthenticated) {
			goto('/login');
			return;
		}
		currentServerUrl = serverConfigStore.getCurrentServerUrl();
		currentRpcUrl = serverConfigStore.getCurrentRpcUrl();
		checkEndpointHealth();
	});

	async function checkEndpointHealth() {
		apiStatus = 'checking';
		rpcStatus = 'checking';

		// Check Transaction API via Tauri (to avoid CORS issues)
		try {
			const { tauriWalletAPI } = await import('$lib/services/tauri-wallet-api.js');
			const storeState = get(authStore);
			const address = storeState.address || 'tzei1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9v4nac';

			const response = await tauriWalletAPI.getTransactions(address, 1, 0, currentServerUrl);
			console.log('API health check response:', response);

			// If we got ANY response object back (even with an error), the server is online
			// Only mark offline if there's a low-level network error
			if (response.success) {
				apiStatus = 'online';
			} else if (response.error) {
				console.log('API error message:', response.error);

				// Check if error is a network connectivity issue (not a 404, 500, or application error)
				// Network errors typically have these patterns from reqwest/Rust
				const networkErrors = ['error sending request', 'connection refused', 'connection reset', 'connection timed out', 'no route to host', 'network unreachable'];
				const hasNetworkError = networkErrors.some(err => response.error!.toLowerCase().includes(err.toLowerCase()));

				// HTTP errors mean server responded (404, 500, etc)
				// Error format: "Failed to fetch transactions: API error: 404"
				const isHttpError = response.error!.includes('API error:') || /API error: \d{3}/.test(response.error!);

				// If it's an HTTP error, server is online; if network error and NOT HTTP error, it's offline
				const newStatus = isHttpError ? 'online' : (hasNetworkError ? 'offline' : 'online');
				apiStatus = newStatus;
				console.log('Setting apiStatus to:', newStatus);
			} else {
				apiStatus = 'offline';
				console.log('Setting apiStatus to: offline (no error)');
			}
		} catch (error) {
			console.error('API health check error:', error);
			apiStatus = 'offline';
			console.log('Setting apiStatus to: offline (exception)');
		}

		// Check RPC Server via Tauri (to avoid CORS issues)
		try {
			const { tauriWalletAPI } = await import('$lib/services/tauri-wallet-api.js');
			const storeState = get(authStore);
			const address = storeState.address || 'tzei1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9v4nac';

			const response = await tauriWalletAPI.getBalance(address, currentRpcUrl);
			console.log('RPC health check response:', response);

			// If we got ANY response object back (even with an error), the server is online
			if (response.success) {
				rpcStatus = 'online';
			} else if (response.error) {
				console.log('RPC error message:', response.error);

				// Check if error is a network connectivity issue
				const networkErrors = ['error sending request', 'connection refused', 'connection reset', 'connection timed out', 'no route to host', 'network unreachable'];
				const hasNetworkError = networkErrors.some(err => response.error!.toLowerCase().includes(err.toLowerCase()));

				// RPC errors mean server responded (just returned an RPC error)
				// Error format: "Failed to fetch balance: RPC error: 404"
				const isRpcError = response.error!.includes('RPC error:') || /RPC error: \d{3}/.test(response.error!);

				// If it's an RPC error, server is online; if network error and NOT RPC error, it's offline
				const newStatus = isRpcError ? 'online' : (hasNetworkError ? 'offline' : 'online');
				rpcStatus = newStatus;
				console.log('Setting rpcStatus to:', newStatus);
			} else {
				rpcStatus = 'offline';
				console.log('Setting rpcStatus to: offline (no error)');
			}
		} catch (error) {
			console.error('RPC health check error:', error);
			rpcStatus = 'offline';
			console.log('Setting rpcStatus to: offline (exception)');
		}

		// Force UI update by logging final states
		console.log('Final status - API:', apiStatus, 'RPC:', rpcStatus);
	}

	function getStatusBadge(status: 'checking' | 'online' | 'offline') {
		console.log('getStatusBadge called with:', status);
		switch (status) {
			case 'checking':
				return { text: 'Checking...', class: 'text-yellow-600 dark:text-yellow-400' };
			case 'online':
				return { text: 'Online', class: 'text-green-600 dark:text-green-400' };
			case 'offline':
				return { text: 'Offline', class: 'text-red-600 dark:text-red-400' };
		}
	}

	function handleServerChange(serverId: string | undefined) {
		if (!serverId) return;

		serverConfigStore.selectServer(serverId);
		saveMessage = 'Server configuration saved! Checking new endpoints...';

		// Update URLs and recheck health
		currentServerUrl = serverConfigStore.getCurrentServerUrl();
		currentRpcUrl = serverConfigStore.getCurrentRpcUrl();
		checkEndpointHealth();

		setTimeout(() => {
			saveMessage = '';
		}, 5000);
	}

	function getServerBadgeColor(type: string): string {
		switch (type) {
			case 'production': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'testnet': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
			case 'local': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
			default: return 'bg-gray-100 text-gray-800';
		}
	}
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
							<Breadcrumb.Page>Settings</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<!-- Page Header -->
			<div class="bg-card border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-2">
					<Settings2Icon class="h-6 w-6 text-primary" />
					<h1 class="text-2xl font-bold">Settings</h1>
				</div>
				<p class="text-muted-foreground">
					Configure your wallet preferences and appearance
				</p>
			</div>

			<!-- Settings Grid -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Theme Settings -->
				<div class="bg-card border rounded-xl p-6">
					<ThemeSwitcher />
				</div>

				<!-- Security Settings (Placeholder) -->
				<div class="bg-card border rounded-xl p-6">
					<div class="flex items-center gap-2 mb-4">
						<ShieldIcon class="h-5 w-5 text-muted-foreground" />
						<h3 class="text-lg font-semibold">Security</h3>
					</div>
					<div class="space-y-3">
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Session Timeout</p>
								<p class="text-sm text-muted-foreground">Currently set to 30 minutes</p>
							</div>
							<div class="text-sm text-muted-foreground">Active</div>
						</div>
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Auto Logout</p>
								<p class="text-sm text-muted-foreground">On tab close or visibility change</p>
							</div>
							<div class="text-sm text-muted-foreground">Enabled</div>
						</div>
					</div>
				</div>

				<!-- Server Selection -->
				<div class="bg-card border rounded-xl p-6">
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-2">
							<ServerIcon class="h-5 w-5 text-muted-foreground" />
							<h3 class="text-lg font-semibold">ZeiCoin Server</h3>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onclick={checkEndpointHealth}
							disabled={apiStatus === 'checking' || rpcStatus === 'checking'}
						>
							<RefreshCwIcon class="h-4 w-4 mr-2 {(apiStatus === 'checking' || rpcStatus === 'checking') ? 'animate-spin' : ''}" />
							Refresh Status
						</Button>
					</div>

					{#if saveMessage}
						<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 flex items-start gap-2">
							<CheckIcon class="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
							<p class="text-sm text-green-800 dark:text-green-200">{saveMessage}</p>
						</div>
					{/if}

					<div class="space-y-4">
						<div class="space-y-2">
							<Label for="server-select">Select Server</Label>
							<Select.Root
								type="single"
								onValueChange={(v: any) => handleServerChange(v)}
							>
								<Select.Trigger id="server-select" class="w-full">
									<span>{availableServers.find(s => s.id === selectedServerId)?.name || 'Select a server'}</span>
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Label>Available Servers</Select.Label>
										{#each availableServers as server}
											<Select.Item value={server.id} label={server.name}>
												<div class="flex flex-col gap-1">
													<div class="flex items-center gap-2">
														{#if server.id === selectedServerId}
															<CheckIcon class="h-4 w-4 text-green-600 dark:text-green-400" />
														{/if}
														<span class="font-medium">{server.name}</span>
														<span class="px-2 py-0.5 rounded-full text-xs font-medium {getServerBadgeColor(server.type)}">
															{server.type}
														</span>
													</div>
													<span class="text-xs text-muted-foreground">{server.description}</span>
												</div>
											</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>

						<div class="pt-2 border-t border-border space-y-3">
							<div>
								<div class="flex items-center justify-between mb-1">
									<p class="text-sm font-medium">Transaction API</p>
									<span class="text-xs {getStatusBadge(apiStatus).class}">{getStatusBadge(apiStatus).text}</span>
								</div>
								<p class="text-xs text-muted-foreground font-mono">{currentServerUrl}</p>
							</div>
							<div>
								<div class="flex items-center justify-between mb-1">
									<p class="text-sm font-medium">JSON-RPC Server</p>
									<span class="text-xs {getStatusBadge(rpcStatus).class}">{getStatusBadge(rpcStatus).text}</span>
								</div>
								<p class="text-xs text-muted-foreground font-mono">{currentRpcUrl}</p>
							</div>
						</div>

						<div class="pt-2 border-t border-border">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium">Wallet Backend</p>
									<p class="text-xs text-muted-foreground font-mono mt-1">Tauri (Rust)</p>
								</div>
								<span class="text-xs text-green-600 dark:text-green-400">Active</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Additional Settings Placeholder -->
				<div class="bg-card border rounded-xl p-6">
					<h3 class="text-lg font-semibold mb-4">Advanced Options</h3>
					<div class="space-y-3">
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Debug Mode</p>
								<p class="text-sm text-muted-foreground">Show detailed console logs</p>
							</div>
							<div class="text-sm text-muted-foreground">Disabled</div>
						</div>
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Transaction Cache</p>
								<p class="text-sm text-muted-foreground">Cache transaction data locally</p>
							</div>
							<div class="text-sm text-muted-foreground">Enabled</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
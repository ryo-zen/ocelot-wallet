<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

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
	import { formatAmount, type Transaction } from '$lib/components/transactions/transaction-utils.js';
	import CopyIcon from "@lucide/svelte/icons/copy";
	import CheckIcon from "@lucide/svelte/icons/check";

	let copied = $state(false);
	let infoBannerDismissed = $state(false);

	function dismissInfoBanner() {
		sessionStorage.setItem('info_banner_dismissed', '1');
		infoBannerDismissed = true;
	}

	function copyAddress() {
		if (!walletAddress) return;
		navigator.clipboard.writeText(walletAddress);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	let currentWallet = $state('');
	let currentBalance = $state('');
	let walletAddress = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let isNewWallet = $state(false);
	let recentTxs = $state<Transaction[]>([]);

	function getFaucetKey(address: string) { return `faucet_next_claim_at_${address}`; }

	type FaucetStatus = 'idle' | 'claiming' | 'rate_limited' | 'error';
	let faucetStatus = $state<FaucetStatus>('idle');
	let faucetRetrySeconds = $state(0);
	let faucetError = $state('');
	let faucetCountdownInterval: ReturnType<typeof setInterval> | null = null;

	function formatRetryTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}

	function startFaucetCountdown(address: string, nextClaimAt: number) {
		if (faucetCountdownInterval) clearInterval(faucetCountdownInterval);
		function tick() {
			const remaining = Math.max(0, Math.round((nextClaimAt - Date.now()) / 1000));
			faucetRetrySeconds = remaining;
			if (remaining <= 0) {
				clearInterval(faucetCountdownInterval!);
				faucetCountdownInterval = null;
				faucetStatus = 'idle';
				localStorage.removeItem(getFaucetKey(address));
			}
		}
		tick();
		faucetCountdownInterval = setInterval(tick, 1000);
	}

	function checkFaucetLocalStorage(address: string) {
		const stored = localStorage.getItem(getFaucetKey(address));
		if (!stored) return;
		const nextClaimAt = parseInt(stored, 10);
		if (Date.now() < nextClaimAt) {
			faucetStatus = 'rate_limited';
			startFaucetCountdown(address, nextClaimAt);
		} else {
			localStorage.removeItem(getFaucetKey(address));
		}
	}

	async function claimFaucet() {
		const storeState = get(authStore);
		const address = storeState.address;
		if (!address) return;
		const apiUrl = serverConfigStore.getCurrentServerUrl();
		faucetStatus = 'claiming';
		faucetError = '';
		try {
			const response = await tauriWalletAPI.callFaucet(address, 200, apiUrl);
			if (tauriWalletAPI.isSuccess(response)) {
				const data = tauriWalletAPI.unwrap(response);
				if (data.claimed) {
					const nextClaimAt = Date.now() + 24 * 60 * 60 * 1000;
					localStorage.setItem(getFaucetKey(address), String(nextClaimAt));
					faucetStatus = 'rate_limited';
					startFaucetCountdown(address, nextClaimAt);
				} else if (data.retry_after_seconds != null) {
					const nextClaimAt = Date.now() + data.retry_after_seconds * 1000;
					localStorage.setItem(getFaucetKey(address), String(nextClaimAt));
					faucetStatus = 'rate_limited';
					startFaucetCountdown(address, nextClaimAt);
				} else {
					faucetStatus = 'error';
					faucetError = data.error ?? 'Faucet unavailable';
				}
			} else {
				faucetStatus = 'error';
				faucetError = response.error ?? 'Failed to reach faucet';
			}
		} catch {
			faucetStatus = 'error';
			faucetError = 'Network error';
		}
	}

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

				// Fetch most recent transaction
				const apiUrl = serverConfigStore.getCurrentServerUrl();
				const txResponse = await tauriWalletAPI.getTransactions(address, 3, 0, apiUrl);
				if (tauriWalletAPI.isSuccess(txResponse)) {
					const txData = tauriWalletAPI.unwrap(txResponse);
					const txResult = JSON.parse(txData.transactions_json);
					recentTxs = txResult.transactions ?? [];
				}
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

	let loadedForWallet = '';

	onMount(() => {
		infoBannerDismissed = sessionStorage.getItem('info_banner_dismissed') === '1';

		const creds = authStore.getCredentials();
		loadedForWallet = creds.wallet ?? '';

		const initAddress = get(authStore).address ?? '';
		fetchBalance();
		if (initAddress) checkFaucetLocalStorage(initAddress);

		const unsubscribe = authStore.subscribe(state => {
			if (state.isAuthenticated && state.wallet && state.wallet !== loadedForWallet) {
				loadedForWallet = state.wallet;
				if (faucetCountdownInterval) clearInterval(faucetCountdownInterval);
				faucetStatus = 'idle';
				fetchBalance().then(() => {
					const addr = get(authStore).address ?? '';
					if (addr) checkFaucetLocalStorage(addr);
				});
			}
		});

		return () => {
			unsubscribe();
			if (faucetCountdownInterval) clearInterval(faucetCountdownInterval);
		};
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
		<div class="@container flex flex-1 flex-col gap-4 p-4 pt-0">
			<!-- Info Banner -->
			{#if !infoBannerDismissed}
				<div class="flex items-start justify-between gap-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
					<p class="text-sm text-blue-800 dark:text-blue-200">
						Ocelot Wallet is running on testnet — coins have no real value and the project is under active development.
						<a href="/info" class="font-semibold underline underline-offset-2 hover:no-underline ml-1">Learn more</a>
					</p>
					<button
						onclick={dismissInfoBanner}
						class="shrink-0 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-lg leading-none mt-0.5"
						aria-label="Dismiss"
					>&#x2715;</button>
				</div>
			{/if}

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
							<div class="flex items-center gap-2">
								<p class="font-mono text-sm break-all">{walletAddress || 'Not available'}</p>
								{#if walletAddress}
									<button
										onclick={copyAddress}
										class="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
										title="Copy address"
									>
										{#if copied}
											<CheckIcon class="size-4 text-green-500" />
										{:else}
											<CopyIcon class="size-4" />
										{/if}
									</button>
								{/if}
							</div>
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

			<div class="grid gap-6 grid-cols-1 @[540px]:grid-cols-2 @[1080px]:grid-cols-4">
				<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
					<div class="space-y-1 mb-4">
						<h3 class="text-lg font-bold">Recent Transactions</h3>
						<p class="text-muted-foreground font-medium line-clamp-2 min-h-[3rem]">Latest activity</p>
					</div>
					<div>
						{#if isLoading}
							<div class="text-center py-8">
								<span class="text-muted-foreground text-sm">Loading...</span>
							</div>
						{:else if recentTxs.length > 0}
							<div class="w-full">
								<div class="flex items-center justify-between pb-2 border-b border-border">
									<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
									<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</span>
								</div>
								{#each recentTxs as tx (tx.hash ?? tx.tx_hash ?? tx.id)}
									{@const isSent = tx.sender === walletAddress}
									<div class="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
										<p class="text-sm font-medium shrink-0">{isSent ? 'Sent' : 'Received'}</p>
										<p class="text-sm font-bold text-right shrink-0 {isSent ? 'text-destructive' : 'text-primary'}">
											{isSent ? '-' : '+'}{formatAmount(tx.amount)} ZEI
										</p>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-center py-8">
								<span class="text-muted-foreground text-sm">No recent transactions</span>
							</div>
						{/if}
					</div>
				</div>
				<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
					<div class="space-y-1 mb-4">
						<h3 class="text-lg font-bold">Quick Actions</h3>
						<p class="text-muted-foreground font-medium line-clamp-2 min-h-[3rem]">Common tasks</p>
					</div>
					<div class="space-y-2">
						<Button class="w-full" onclick={() => window.location.href = '/wallet/send'}>Send ZEI</Button>
						<Button variant="outline" class="w-full" onclick={() => window.location.href = '/wallet/transactions'}>View Transactions</Button>
					</div>
				</div>
				<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
					<div class="space-y-1 mb-4">
						<h3 class="text-lg font-bold">L2 Messages</h3>
						<p class="text-muted-foreground font-medium line-clamp-2 min-h-[3rem]">Send notes with transactions</p>
					</div>
					<div class="space-y-2">
						<Button class="w-full" onclick={() => window.location.href = '/messages/compose'}>Compose Message</Button>
						<Button variant="outline" class="w-full" onclick={() => window.location.href = '/messages'}>View Messages</Button>
					</div>
				</div>
				<!-- Faucet Card -->
				<div class="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
					<div class="space-y-1 mb-4">
						<h3 class="text-lg font-bold">Get ZEI</h3>
						<p class="text-muted-foreground font-medium line-clamp-2 min-h-[3rem]">Testnet faucet — 0.2 ZEI per day</p>
					</div>
					<div>
						{#if faucetStatus === 'idle'}
							<Button class="w-full" onclick={claimFaucet} disabled={!walletAddress}>Claim 0.2 ZEI</Button>
						{:else if faucetStatus === 'claiming'}
							<Button class="w-full" disabled>Claiming...</Button>
						{:else if faucetStatus === 'rate_limited'}
							<Button class="w-full" disabled>Claim 0.2 ZEI</Button>
							<p class="text-sm font-semibold text-primary mt-2">Already claimed today — ZEI will arrive once confirmed.</p>
							<p class="text-sm text-muted-foreground mt-1">Next claim available in {formatRetryTime(faucetRetrySeconds)}</p>
						{:else if faucetStatus === 'error'}
							<p class="text-sm text-destructive mb-2">{faucetError}</p>
							<Button variant="outline" class="w-full" onclick={claimFaucet}>Try again</Button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

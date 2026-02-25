<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Button } from "$lib/components/ui/button";
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import InboxIcon from "@lucide/svelte/icons/inbox";
	import { authStore } from '$lib/stores/auth.js';
	import { addressBookStore } from '$lib/stores/address-book.js';
	import { serverConfigStore } from '$lib/stores/server-config.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { formatDate, type Transaction } from '$lib/components/transactions/transaction-utils.js';

	let messages: Transaction[] = $state([]);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let isAuthenticated = $state(false);
	let currentAddress = $state('');
	let walletName = $state('');
	let addressBookEntries: { name: string; address: string }[] = $state([]);

	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
		currentAddress = state.address || '';
		walletName = state.wallet || '';
	});

	addressBookStore.subscribe(state => {
		addressBookEntries = state.entries;
	});

	function resolveAddress(address: string): { name: string | null; address: string } {
		if (!address) return { name: null, address: '' };
		if (address === currentAddress) return { name: walletName || null, address };
		const entry = addressBookEntries.find(e => e.address === address);
		return { name: entry?.name ?? null, address };
	}

	function truncateAddress(address: string): string {
		if (address.length <= 20) return address;
		return `${address.slice(0, 12)}...${address.slice(-6)}`;
	}

	async function loadMessages() {
		if (!isAuthenticated) return;

		isLoading = true;
		errorMessage = '';

		try {
			const { wallet, password } = authStore.getCredentials();
			if (!wallet || !password) throw new Error('Authentication expired');

			const storeState = get(authStore);
			const userAddress = storeState.address;
			if (!userAddress) throw new Error('Wallet address not found in session');

			currentAddress = userAddress;

			const apiUrl = serverConfigStore.getCurrentServerUrl();
			const { tauriWalletAPI } = await import('$lib/services/tauri-wallet-api.js');
			const response = await tauriWalletAPI.getTransactions(userAddress, 200, 0, apiUrl);

			if (tauriWalletAPI.isSuccess(response)) {
				const data = tauriWalletAPI.unwrap(response);
				const result = JSON.parse(data.transactions_json);
				if (result.transactions) {
					messages = result.transactions.filter((tx: Transaction) => tx.message);
				}
			} else {
				errorMessage = response.error || 'Failed to load messages';
			}

			authStore.refreshSession();
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('Authentication expired')) {
					authStore.logout();
					goto('/login');
					return;
				}
				errorMessage = error.message;
			}
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		if (!isAuthenticated) {
			goto('/login');
			return;
		}
		loadMessages();
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
							<Breadcrumb.Link href="/messages">Messages</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator />
						<Breadcrumb.Item>
							<Breadcrumb.Page>All Messages</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>

		<div class="flex flex-col gap-6 p-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-semibold tracking-tight">Messages</h1>
					<p class="text-muted-foreground mt-1">
						Send and receive L2 messages with transactions
					</p>
				</div>
				<Button href="/messages/compose">
					<MessageSquareIcon class="mr-2 h-4 w-4" />
					Compose
				</Button>
			</div>

			{#if isLoading}
				<div class="text-muted-foreground text-sm">Loading messages...</div>
			{:else if errorMessage}
				<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium">
					{errorMessage}
				</div>
			{:else if messages.length === 0}
				<div class="border rounded-xl p-12">
					<div class="flex flex-col items-center justify-center text-center space-y-4">
						<div class="rounded-full bg-muted p-6">
							<InboxIcon class="h-12 w-12 text-muted-foreground" />
						</div>
						<div class="space-y-2">
							<h3 class="text-xl font-semibold">No messages yet</h3>
							<p class="text-muted-foreground max-w-md">
								Messages will appear here once you send or receive L2 messages attached to transactions.
							</p>
						</div>
						<Button href="/messages/compose" variant="outline" class="mt-4">
							<MessageSquareIcon class="mr-2 h-4 w-4" />
							Compose Message
						</Button>
					</div>
				</div>
			{:else}
				<div class="space-y-3">
					{#each messages as tx (tx.hash ?? tx.tx_hash ?? tx.id)}
						{@const from = resolveAddress(tx.sender || '')}
						{@const to = resolveAddress(tx.recipient)}
						{@const isSent = tx.sender === currentAddress}
						<div class="bg-card border rounded-xl p-4 space-y-3">
							<div class="flex items-start justify-between gap-3">
								<div class="space-y-3 flex-1 min-w-0">
									<div class="space-y-0.5">
										<span class="text-muted-foreground font-medium text-sm">From</span>
										{#if from.name}
											<p class="text-sm font-medium">{from.name}</p>
											<p class="font-mono text-xs text-muted-foreground italic" title={from.address}>{truncateAddress(from.address)}</p>
										{:else}
											<p class="font-mono text-sm break-all">{from.address || 'Unknown'}</p>
										{/if}
									</div>
									<div class="space-y-0.5">
										<span class="text-muted-foreground font-medium text-sm">To</span>
										{#if to.name}
											<p class="text-sm font-medium">{to.name}</p>
											<p class="font-mono text-xs text-muted-foreground italic" title={to.address}>{truncateAddress(to.address)}</p>
										{:else}
											<p class="font-mono text-sm break-all">{to.address}</p>
										{/if}
									</div>
								</div>
								<span class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full {isSent ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}">
									{isSent ? 'Sent' : 'Received'}
								</span>
							</div>
							<div class="space-y-1">
								<span class="text-muted-foreground font-medium text-sm">Message</span>
								<p class="text-sm italic border-l-2 border-muted-foreground/30 pl-2">{tx.message}</p>
							</div>
							<p class="text-xs text-muted-foreground">{formatDate(tx.timestamp || tx.created_at)}</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

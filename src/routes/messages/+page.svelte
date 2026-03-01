<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import SendIcon from "@lucide/svelte/icons/send";
	import InboxIcon from "@lucide/svelte/icons/inbox";
	import { authStore } from '$lib/stores/auth.js';
	import { addressBookStore } from '$lib/stores/address-book.js';
	import { serverConfigStore } from '$lib/stores/server-config.js';
	import { sendTransaction } from '$lib/components/send/send-transaction.js';
	import ContactPicker from '$lib/components/send/ContactPicker.svelte';
	import BookUserIcon from "@lucide/svelte/icons/book-user";
	import { onMount, onDestroy } from 'svelte';
	import CheckIcon from "@lucide/svelte/icons/check";
	import ClockIcon from "@lucide/svelte/icons/clock-3";
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { formatDate, type Transaction } from '$lib/components/transactions/transaction-utils.js';

	const DUST_AMOUNT = '0.00005';

	interface PendingEntry {
		id: string;
		sender: string;
		recipient: string;
		message: string;
		sentAt: number;
	}

	const PENDING_TTL_MS = 30 * 60 * 1000;

	function pendingKey(address: string) {
		return `ocelot_pending_msgs_${address}`;
	}

	function loadPending(address: string): PendingEntry[] {
		try {
			const raw = localStorage.getItem(pendingKey(address));
			if (!raw) return [];
			const entries: PendingEntry[] = JSON.parse(raw);
			const now = Date.now();
			return entries.filter(e => now - e.sentAt < PENDING_TTL_MS);
		} catch { return []; }
	}

	function savePending(address: string, entries: PendingEntry[]) {
		try {
			localStorage.setItem(pendingKey(address), JSON.stringify(entries));
		} catch {}
	}

	let messages: Transaction[] = $state([]);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let isAuthenticated = $state(false);
	let currentAddress = $state('');
	let walletName = $state('');
	let addressBookEntries: { name: string; address: string }[] = $state([]);

	// Compose state
	let recipient = $state('');
	let message = $state('');
	let isSending = $state(false);
	let sendError = $state('');
	let showContactPicker = $state(false);

	let pollInterval: ReturnType<typeof setInterval>;
	let isInitialLoad = $state(true);
	let chatContainer: HTMLElement;

	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
		currentAddress = state.address || '';
		walletName = state.wallet || '';
	});

	addressBookStore.subscribe(state => {
		addressBookEntries = state.entries;
	});

	let resolvedRecipient = $derived(
		addressBookEntries.find(e => e.address === recipient.trim()) ?? null
	);

	function resolveName(address: string): string | null {
		if (!address) return null;
		if (address === currentAddress) return walletName || null;
		return addressBookEntries.find(e => e.address === address)?.name ?? null;
	}

	function getInitial(address: string): string {
		const name = resolveName(address);
		if (name) return name[0].toUpperCase();
		return address ? address[4]?.toUpperCase() ?? '?' : '?';
	}

	function truncateAddress(address: string): string {
		if (address.length <= 20) return address;
		return `${address.slice(0, 10)}...${address.slice(-6)}`;
	}

	function handleContactSelect(address: string, contactId: string) {
		recipient = address;
		addressBookStore.markAsUsed(contactId);
		showContactPicker = false;
	}

	$effect(() => {
		// depend on messages length to scroll when new messages arrive
		void messages.length;
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	});

	async function loadMessages() {
		if (!isAuthenticated) return;
		if (isInitialLoad) isLoading = true;
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
					const dbMessages: Transaction[] = result.transactions.filter(
						(tx: Transaction) => tx.message
					);

					let pending = loadPending(currentAddress);
					pending = pending.filter(entry =>
						!dbMessages.some(
							(tx: Transaction) =>
								tx.sender === entry.sender &&
								tx.recipient === entry.recipient &&
								tx.message === entry.message &&
								Number(tx.timestamp ?? tx.created_at ?? 0) >= entry.sentAt - 60_000
						)
					);
					savePending(currentAddress, pending);

					const pendingTxs: Transaction[] = pending.map(e => ({
						id: e.id,
						sender: e.sender,
						recipient: e.recipient,
						amount: 0.00005,
						message: e.message,
						timestamp: e.sentAt,
						status: 'pending' as const,
					}));

					const dbSorted = [...dbMessages].sort(
						(a, b) =>
							Number(a.timestamp ?? a.created_at ?? 0) -
							Number(b.timestamp ?? b.created_at ?? 0)
					);
					messages = [...dbSorted, ...pendingTxs];
				}
			} else {
				errorMessage = response.error || 'Failed to load messages';
			}
			authStore.refreshSession();
			isInitialLoad = false;
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

	async function handleSend(e: Event) {
		e.preventDefault();
		sendError = '';
		if (!recipient.trim()) { sendError = 'Recipient address is required'; return; }
		if (!message.trim()) { sendError = 'Message is required'; return; }
		const credentials = authStore.getCredentials();
		if (!credentials.wallet || !credentials.password) { sendError = 'Not authenticated'; return; }
		isSending = true;
		const result = await sendTransaction(
			{ wallet: credentials.wallet, password: credentials.password },
			{ recipient: recipient.trim(), amount: DUST_AMOUNT, message: message.trim() }
		);
		if (result.success) {
			const entry: PendingEntry = {
				id: crypto.randomUUID(),
				sender: currentAddress,
				recipient: recipient.trim(),
				message: message.trim(),
				sentAt: Date.now(),
			};
			savePending(currentAddress, [...loadPending(currentAddress), entry]);

			message = '';
			authStore.refreshSession();
			await loadMessages();
		} else {
			sendError = result.error || 'Failed to send message';
		}
		isSending = false;
	}

	onMount(() => {
		if (!isAuthenticated) {
			goto('/login');
			return;
		}
		addressBookStore.init();
		loadMessages();
		pollInterval = setInterval(loadMessages, 5000);
	});

	onDestroy(() => {
		clearInterval(pollInterval);
		if (currentAddress) savePending(currentAddress, loadPending(currentAddress));
	});
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset class="flex flex-col overflow-hidden">
		<header class="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear border-b">
			<div class="flex items-center gap-2 px-4">
				<Sidebar.Trigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item>
							<Breadcrumb.Page>Messages</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>

		<!-- Chat messages -->
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
			{#if isLoading}
				<div class="flex items-center justify-center h-full">
					<p class="text-muted-foreground text-sm">Loading messages...</p>
				</div>
			{:else if errorMessage}
				<div class="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm font-medium">
					{errorMessage}
				</div>
			{:else if messages.length === 0}
				<div class="flex flex-col items-center justify-center h-full text-center space-y-4">
					<div class="rounded-full bg-muted p-6">
						<InboxIcon class="h-10 w-10 text-muted-foreground" />
					</div>
					<div class="space-y-1">
						<h3 class="text-lg font-semibold">No messages yet</h3>
						<p class="text-muted-foreground text-sm max-w-xs">
							Send your first message using the compose bar below.
						</p>
					</div>
				</div>
			{:else}
				{#each messages as tx (tx.hash ?? tx.tx_hash ?? tx.id)}
					{@const isSentByMe = tx.sender === currentAddress}
					{@const senderName = resolveName(tx.sender || '')}

					{#if isSentByMe}
						<!-- Sent bubble — right aligned -->
						<div class="flex justify-end">
							<div class="max-w-xs lg:max-w-md space-y-1">
								<div class="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5">
									<p class="text-sm">{tx.message}</p>
								</div>
								<div class="flex items-center justify-end gap-1 pr-1">
									<p class="text-xs text-muted-foreground">
										{formatDate(tx.timestamp || tx.created_at)}
									</p>
									{#if tx.status === 'confirmed' || tx.block_height}
										<CheckIcon class="size-3 text-muted-foreground" />
									{:else}
										<ClockIcon class="size-3 text-muted-foreground/50" />
									{/if}
								</div>
							</div>
						</div>
					{:else}
						<!-- Received bubble — left aligned with avatar -->
						<div class="flex items-end gap-2">
							<div class="bg-muted text-muted-foreground rounded-full w-8 h-8 flex items-center justify-center text-xs font-semibold shrink-0">
								{getInitial(tx.sender || '')}
							</div>
							<div class="max-w-xs lg:max-w-md space-y-1">
								<p class="text-xs text-muted-foreground pl-1 font-medium">
									{senderName ?? truncateAddress(tx.sender || '')}
								</p>
								<div class="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-2.5">
									<p class="text-sm">{tx.message}</p>
								</div>
								<div class="flex items-center gap-1 pl-1">
									<p class="text-xs text-muted-foreground">
										{formatDate(tx.timestamp || tx.created_at)}
									</p>
									{#if tx.status === 'confirmed' || tx.block_height}
										<CheckIcon class="size-3 text-muted-foreground" />
									{:else}
										<ClockIcon class="size-3 text-muted-foreground/50" />
									{/if}
								</div>
							</div>
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		<!-- Compose bar -->
		<div class="border-t bg-background p-3 shrink-0">
			{#if sendError}
				<p class="text-destructive text-xs mb-2 px-1">{sendError}</p>
			{/if}
			<form onsubmit={handleSend} class="space-y-2">
				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="To: tzei1..."
						bind:value={recipient}
						disabled={isSending}
						class="font-mono text-sm flex-1"
					/>
					{#if resolvedRecipient}
						<span class="text-xs text-muted-foreground self-center shrink-0">{resolvedRecipient.name}</span>
					{/if}
					<Button
						type="button"
						variant="outline"
						size="icon"
						onclick={() => showContactPicker = true}
						disabled={isSending}
						title="Select from address book"
					>
						<BookUserIcon class="size-4" />
					</Button>
				</div>
				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="Write a message..."
						bind:value={message}
						disabled={isSending}
						class="flex-1"
					/>
					<Button type="submit" size="icon" disabled={isSending || !recipient.trim() || !message.trim()}>
						<SendIcon class="size-4" />
					</Button>
				</div>
			</form>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<ContactPicker
	bind:open={showContactPicker}
	onSelect={handleContactSelect}
	onClose={() => showContactPicker = false}
/>

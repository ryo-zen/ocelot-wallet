<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Card } from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Textarea } from "$lib/components/ui/textarea";
	import SendIcon from "@lucide/svelte/icons/send";
	import BookUserIcon from "@lucide/svelte/icons/book-user";
	import { authStore } from '$lib/stores/auth.js';
	import { addressBookStore } from '$lib/stores/address-book.js';
	import { sendTransaction } from '$lib/components/send/send-transaction.js';
	import ContactPicker from '$lib/components/send/ContactPicker.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Dust amount — minimum to carry a message (just the fee, 0.00005 ZEI)
	const DUST_AMOUNT = '0.00005';

	let recipient = $state('');
	let message = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let success = $state('');
	let isAuthenticated = $state(false);
	let showContactPicker = $state(false);
	let walletName = $state('');
	let currentAddress = $state('');
	let addressBookEntries: { name: string; address: string }[] = $state([]);

	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
		walletName = state.wallet || '';
		currentAddress = state.address || '';
	});

	addressBookStore.subscribe(state => {
		addressBookEntries = state.entries;
	});

	let resolvedContact = $derived(
		addressBookEntries.find(e => e.address === recipient.trim()) ?? null
	);

	function truncateAddress(address: string): string {
		if (address.length <= 20) return address;
		return `${address.slice(0, 12)}...${address.slice(-6)}`;
	}

	function handleContactSelect(address: string, contactId: string) {
		recipient = address;
		addressBookStore.markAsUsed(contactId);
		showContactPicker = false;
	}

	onMount(() => {
		if (!isAuthenticated) {
			return goto('/login');
		}
		addressBookStore.init();
	});

	async function handleSend(e: Event) {
		e.preventDefault();
		error = '';
		success = '';

		if (!recipient.trim()) {
			error = 'Recipient address is required';
			return;
		}
		if (!message.trim()) {
			error = 'Message is required';
			return;
		}

		const credentials = authStore.getCredentials();
		if (!credentials.wallet || !credentials.password) {
			error = 'Not authenticated';
			return;
		}

		isLoading = true;

		const result = await sendTransaction(
			{ wallet: credentials.wallet, password: credentials.password },
			{
				recipient: recipient.trim(),
				amount: DUST_AMOUNT,
				message: message.trim(),
			}
		);

		if (result.success) {
			success = 'Message sent successfully.';
			recipient = '';
			message = '';
			authStore.refreshSession();
		} else {
			error = result.error || 'Failed to send message';
		}

		isLoading = false;
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
							<Breadcrumb.Link href="/messages">Messages</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator />
						<Breadcrumb.Item>
							<Breadcrumb.Page>Compose</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>

		<div class="flex flex-col gap-6 p-6">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">Compose Message</h1>
				<p class="text-muted-foreground mt-1">
					Send an L2 message attached to a transaction
				</p>
			</div>

			<Card class="p-6">
				<form class="space-y-6" onsubmit={handleSend}>

					{#if error}
						<div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm font-medium">
							{error}
						</div>
					{/if}

					{#if success}
						<div class="bg-primary/10 border border-primary/20 rounded-lg p-3 text-primary text-sm font-medium">
							{success}
						</div>
					{/if}

					<div class="space-y-2">
						<Label>From</Label>
						<div class="rounded-md border bg-muted/50 px-3 py-2.5">
							<p class="text-sm font-medium">{walletName}</p>
							<p class="font-mono text-xs text-muted-foreground italic" title={currentAddress}>{truncateAddress(currentAddress)}</p>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="recipient">To</Label>
						<div class="flex gap-2">
							<Input
								id="recipient"
								type="text"
								placeholder="tzei1..."
								bind:value={recipient}
								disabled={isLoading}
								class="font-mono text-sm flex-1"
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onclick={() => showContactPicker = true}
								title="Select from address book"
								disabled={isLoading}
							>
								<BookUserIcon class="size-4" />
							</Button>
						</div>
						{#if resolvedContact}
							<p class="text-xs text-muted-foreground">
								<span class="font-medium text-foreground">{resolvedContact.name}</span>
								<span class="italic ml-1">{truncateAddress(recipient.trim())}</span>
							</p>
						{:else}
							<p class="text-sm text-muted-foreground">
								Enter the ZeiCoin address of the recipient
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="message">Message</Label>
						<Textarea
							id="message"
							placeholder="Enter your message..."
							rows={8}
							bind:value={message}
							disabled={isLoading}
						/>
						<p class="text-sm text-muted-foreground">
							Maximum 1000 characters
						</p>
					</div>

					<div class="flex items-center justify-between pt-4 border-t">
						<div class="text-sm text-muted-foreground">
							Total cost: ~0.0001 ZEI (dust + fee)
						</div>
						<div class="flex gap-3">
							<Button href="/messages" variant="outline" disabled={isLoading}>
								Cancel
							</Button>
							<Button type="submit" disabled={isLoading}>
								<SendIcon class="mr-2 h-4 w-4" />
								{isLoading ? 'Sending...' : 'Send Message'}
							</Button>
						</div>
					</div>
				</form>
			</Card>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<ContactPicker
	bind:open={showContactPicker}
	onSelect={handleContactSelect}
	onClose={() => showContactPicker = false}
/>

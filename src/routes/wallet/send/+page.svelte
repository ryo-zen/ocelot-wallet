<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { authStore } from "$lib/stores/auth.js";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";

	let recipient = '';
	let amount = '';
	let message = '';
	let category = '';
	let referenceId = '';
	let tags = '';
	let isPrivate = false;
	let isLoading = false;
	let error = '';
	let success = '';

	const categories = [
		{ value: '', label: 'Select category' },
		{ value: 'payment', label: 'Payment' },
		{ value: 'donation', label: 'Donation' },
		{ value: 'refund', label: 'Refund' },
		{ value: 'salary', label: 'Salary' },
		{ value: 'invoice', label: 'Invoice' },
		{ value: 'other', label: 'Other' }
	];

	let showConfirmDialog = false;
	let currentBalance = '0';

	onMount(() => {
		// Get current balance - this will handle auth check gracefully
		getBalance();
	});

	async function getBalance() {
		// Refresh session first
		const sessionRefreshed = authStore.refreshSession();
		if (!sessionRefreshed) return;
		
		const credentials = authStore.getCredentials();
		if (!credentials.wallet || !credentials.password) return;

		try {
			const response = await fetch('http://127.0.0.1:8081/ws', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					command: 'balance',
					wallet: credentials.wallet,
					password: credentials.password
				})
			});
			
			const result = await response.json();
			if (result.success) {
				currentBalance = result.balance || '0';
				authStore.refreshSession();
			}
		} catch (err) {
			console.error('Failed to get balance:', err);
		}
	}

	function clearMessages() {
		error = '';
		success = '';
	}

	function validateForm() {
		clearMessages();
		
		if (!recipient.trim()) {
			error = 'Recipient address is required';
			return false;
		}
		
		if (!amount || parseFloat(amount) <= 0) {
			error = 'Valid amount is required';
			return false;
		}
		
		const balance = parseFloat(currentBalance);
		const sendAmount = parseFloat(amount);
		
		if (sendAmount > balance) {
			error = 'Insufficient balance';
			return false;
		}
		
		return true;
	}

	function handleSend() {
		console.log('handleSend called');
		console.log('Current form values:', { recipient, amount, currentBalance });
		if (!validateForm()) {
			console.log('Validation failed:', error);
			return;
		}
		console.log('Validation passed, showing dialog');
		showConfirmDialog = true;
	}

	async function executeSend() {
		showConfirmDialog = false;
		isLoading = true;
		clearMessages();

		const credentials = authStore.getCredentials();
		if (!credentials.wallet || !credentials.password) {
			error = 'Not authenticated';
			isLoading = false;
			return;
		}

		try {
			// First save L2 enhancement data if provided
			let tempId = null;
			if (message || category || referenceId || tags) {
				const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
				
				// Get sender address for L2 data
				let senderAddress = credentials.wallet;
				try {
					const addressResponse = await fetch('http://127.0.0.1:8081/ws', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							command: 'address',
							wallet: credentials.wallet,
							password: credentials.password
						})
					});
					
					const addressResult = await addressResponse.json();
					if (addressResult.success && addressResult.address) {
						senderAddress = addressResult.address;
					}
				} catch (e) {
					console.log('Could not get sender address, using wallet name');
				}

				const l2Response = await fetch('http://localhost:8080/api/l2/enhancements', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						sender: senderAddress,
						recipient: recipient.trim(),
						message: message.trim() || null,
						category: category || null,
						reference_id: referenceId.trim() || null,
						tags: tagArray,
						is_private: isPrivate
					})
				});

				if (l2Response.ok) {
					const l2Result = await l2Response.json();
					tempId = l2Result.temp_id;
					
					// Update to pending status
					await fetch(`http://localhost:8080/api/l2/enhancements/${tempId}/pending`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			// Send the transaction
			const response = await fetch('http://127.0.0.1:8081/ws', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					command: 'send',
					wallet: credentials.wallet,
					password: credentials.password,
					amount: amount.toString(),
					recipient: recipient.trim()
				})
			});

			const result = await response.json();

			if (result.success) {
				success = `Transaction sent successfully! ${result.transaction_hash ? 'Hash: ' + result.transaction_hash : ''}`;
				// Clear form
				recipient = '';
				amount = '';
				message = '';
				category = '';
				referenceId = '';
				tags = '';
				isPrivate = false;
				// Refresh balance
				setTimeout(() => getBalance(), 2000);
				authStore.refreshSession();
			} else {
				error = `Transaction failed: ${result.error}`;
			}
		} catch (err) {
			error = `Transaction error: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			isLoading = false;
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
							<Breadcrumb.Page>Send</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-6 p-4 pt-0">
			<Card.Root>
				<Card.Header>
					<Card.Title>Send ZEI</Card.Title>
					<Card.Description>Send ZEI with optional message enhancement functionality. Current balance: {currentBalance} ZEI</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					{#if error}
						<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
							{error}
						</div>
					{/if}
					
					{#if success}
						<div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
							{success}
						</div>
					{/if}

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="recipient">Recipient Address *</Label>
							<Input
								id="recipient"
								type="text"
								bind:value={recipient}
								placeholder="tzei1xyz..."
								class="font-mono text-sm"
							/>
						</div>
						<div class="space-y-2">
							<Label for="amount">Amount (ZEI) *</Label>
							<Input
								id="amount"
								type="number"
								bind:value={amount}
								placeholder="1.0"
								step="0.00000001"
								min="0"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="message">Message</Label>
						<textarea
							id="message"
							bind:value={message}
							placeholder="Payment for services rendered..."
							class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-vertical min-h-[80px]"
						></textarea>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="category">Category</Label>
							<select
								id="category"
								bind:value={category}
								class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
							>
								{#each categories as cat}
									<option value={cat.value}>{cat.label}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-2">
							<Label for="referenceId">Reference ID</Label>
							<Input
								id="referenceId"
								type="text"
								bind:value={referenceId}
								placeholder="INV-2024-001"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="tags">Tags (comma-separated)</Label>
						<Input
							id="tags"
							type="text"
							bind:value={tags}
							placeholder="urgent, q4-2024, accounting"
						/>
					</div>

					<div class="flex items-center space-x-2">
						<input
							type="checkbox"
							id="isPrivate"
							bind:checked={isPrivate}
							class="rounded"
						/>
						<Label for="isPrivate" class="font-normal cursor-pointer">Mark as Private</Label>
					</div>
				</Card.Content>
				<Card.Footer>
					<Button
						onclick={handleSend}
						disabled={isLoading}
						class="w-full"
					>
						{#if isLoading}
							Sending...
						{:else}
							Send Transaction
						{/if}
					</Button>
				</Card.Footer>
			</Card.Root>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

{#if showConfirmDialog}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" tabindex="-1" onclick={() => showConfirmDialog = false} onkeydown={(e) => e.key === 'Escape' && (showConfirmDialog = false)}>
		<div class="bg-card border rounded-xl max-w-md w-full p-6 space-y-4" tabindex="-1" role="dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (showConfirmDialog = false)}>
			<div class="text-center">
				<h3 class="text-lg font-bold">Confirm Transaction</h3>
			</div>
			<div class="bg-secondary border rounded-xl p-4 space-y-2">
				<p class="text-xl font-bold text-primary">{amount} ZEI</p>
				<div class="space-y-1">
					<span class="text-muted-foreground font-medium text-sm">Recipient Address</span>
					<p class="font-mono text-sm break-all">{recipient}</p>
				</div>
				{#if message}
					<div class="space-y-1">
						<span class="text-muted-foreground font-medium text-sm">Message</span>
						<p class="text-sm">"{message}"</p>
					</div>
				{/if}
			</div>
			<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
				<p class="font-semibold text-center">This action cannot be undone!</p>
				<p class="text-sm text-center">Your message data will be saved and the transaction will be sent immediately.</p>
			</div>
			<div class="flex gap-3">
				<Button
					variant="outline"
					class="flex-1"
					onclick={() => showConfirmDialog = false}
				>
					Cancel
				</Button>
				<Button
					class="flex-1"
					onclick={executeSend}
				>
					Confirm & Send
				</Button>
			</div>
		</div>
	</div>
{/if}
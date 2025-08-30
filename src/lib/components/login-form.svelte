<script lang="ts">
	import { Label } from "$lib/components/ui/label/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.js';
	import type { HTMLFormAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithElementRef<HTMLFormAttributes> = $props();

	const id = $props.id();
	
	// Wallet selection state
	let selectedWallet = $state("");
	let password = "";
	let errorMessage = "";
	let isLoading = false;

	// Available wallets
	const wallets = [
		{ value: "alice", label: "Alice" },
		{ value: "bob", label: "Bob" },
		{ value: "miner", label: "Miner" },
		{ value: "charlie", label: "Charlie" }
	];

	const triggerContent = $derived(
		wallets.find((w) => w.value === selectedWallet)?.label ?? "Select a wallet"
	);

	async function validateWallet(wallet: string, password: string): Promise<boolean> {
		try {
			const response = await fetch('http://127.0.0.1:8081/ws', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					command: 'balance',
					wallet: wallet,
					password: password
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			
			// Check if the response indicates success (has balance data)
			if (result.error) {
				throw new Error(result.error);
			}
			
			return true;
		} catch (error) {
			console.error('Wallet validation error:', error);
			throw error;
		}
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!selectedWallet || !password) {
			errorMessage = 'Please select a wallet and enter password';
			return;
		}
		
		isLoading = true;
		errorMessage = '';
		
		try {
			await validateWallet(selectedWallet, password);
			
			// Store credentials in auth store
			authStore.login(selectedWallet, password);
			
			// Clear password from form
			password = '';
			
			// Navigate to main wallet interface
			await goto('/wallet/dashboard');
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
					errorMessage = 'Unable to connect to wallet service. Please ensure the CLI Bridge is running on http://localhost:8081';
				} else if (error.message.includes('Invalid password') || error.message.includes('authentication')) {
					errorMessage = 'Invalid password for selected wallet';
				} else if (error.message.includes('Wallet not found')) {
					errorMessage = 'Wallet not found. Please check the wallet name';
				} else {
					errorMessage = `Authentication failed: ${error.message}`;
				}
			} else {
				errorMessage = 'An unexpected error occurred during authentication';
			}
		} finally {
			isLoading = false;
		}
	}
</script>

<form class={cn("flex flex-col gap-6", className)} bind:this={ref} on:submit={handleSubmit} {...restProps}>
	<div class="flex flex-col items-center gap-2 text-center">
		<h1 class="text-2xl font-bold">Access Your Wallet</h1>
		<p class="text-muted-foreground text-balance text-sm">
			Select your wallet and enter password to continue
		</p>
	</div>
	<div class="grid gap-6">
		<div class="grid gap-3">
			<Label>Wallet</Label>
			<Select.Root type="single" name="walletSelect" bind:value={selectedWallet}>
				<Select.Trigger class="w-full">
					{triggerContent}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						<Select.Label>Available Wallets</Select.Label>
						{#each wallets as wallet (wallet.value)}
							<Select.Item value={wallet.value} label={wallet.label}>
								{wallet.label}
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
		<div class="grid gap-3">
			<Label for="password-{id}">Password</Label>
			<Input id="password-{id}" type="password" bind:value={password} required />
		</div>
		
		{#if errorMessage}
			<div class="text-red-500 text-sm text-center">
				{errorMessage}
			</div>
		{/if}
		
		<Button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
			{#if isLoading}
				Validating...
			{:else}
				Access Wallet
			{/if}
		</Button>
	</div>
</form>

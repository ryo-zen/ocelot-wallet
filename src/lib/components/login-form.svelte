<script lang="ts">
	import { onMount } from 'svelte';
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
	let password = $state("");
	let errorMessage = $state("");
	let isLoading = $state(false);
	let walletsLoading = $state(false);

	// Available wallets - dynamically discovered
	let wallets = $state<Array<{ value: string; label: string }>>([]);

	const triggerContent = $derived(
		wallets.find((w) => w.value === selectedWallet)?.label ?? "Select a wallet"
	);

	// Fetch available wallets dynamically from filesystem
	async function fetchAvailableWallets(): Promise<string[]> {
		try {
			const response = await fetch('/api/wallets', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			
			if (!result.success) {
				throw new Error(result.error || 'Failed to discover wallets');
			}
			
			return result.wallets || [];
		} catch (error) {
			console.error('Failed to fetch wallets:', error);
			throw error;
		}
	}

	// Load wallets dynamically on component mount
	onMount(async () => {
		walletsLoading = true;
		errorMessage = '';
		
		try {
			const walletNames = await fetchAvailableWallets();
			
			// Convert wallet names to the format expected by the Select component
			wallets = walletNames.map(name => ({
				value: name,
				label: name.charAt(0).toUpperCase() + name.slice(1)
			}));
			
			if (wallets.length === 0) {
				errorMessage = 'No wallets found in the system. Please create a wallet first.';
			}
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
					errorMessage = 'Unable to connect to wallet service. Please ensure the wallet service is running.';
				} else {
					errorMessage = `Failed to load wallets: ${error.message}`;
				}
			} else {
				errorMessage = 'An unexpected error occurred while loading wallets';
			}
		} finally {
			walletsLoading = false;
		}
	});

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
		
		// Don't allow submission if wallets are still loading
		if (walletsLoading) {
			errorMessage = 'Please wait while wallets are loading';
			return;
		}
		
		// Don't allow submission if no wallets are available
		if (wallets.length === 0) {
			errorMessage = 'No wallets available. Please create a wallet first.';
			return;
		}
		
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

<form class={cn("flex flex-col gap-6", className)} bind:this={ref} onsubmit={handleSubmit} {...restProps}>
	<div class="flex flex-col items-center gap-2 text-center">
		<h1 class="text-2xl font-bold">Access Your Wallet</h1>
		<p class="text-muted-foreground text-balance text-sm">
			Select your wallet and enter password to continue
		</p>
	</div>
	<div class="grid gap-6">
		<div class="grid gap-3">
			<Label>Wallet</Label>
			<Select.Root type="single" name="walletSelect" bind:value={selectedWallet} disabled={walletsLoading || wallets.length === 0}>
				<Select.Trigger class="w-full">
					{#if walletsLoading}
						Loading wallets...
					{:else if wallets.length === 0}
						No wallets available
					{:else}
						{triggerContent}
					{/if}
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
		
		<Button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading || walletsLoading || wallets.length === 0}>
			{#if walletsLoading}
				Loading wallets...
			{:else if isLoading}
				Validating...
			{:else}
				Access Wallet
			{/if}
		</Button>
		
		<Button 
			type="button" 
			variant="outline" 
			class="w-full" 
			onclick={() => goto('/wallet/create/name')}
		>
			Create New Wallet
		</Button>
		
		<Button 
			type="button" 
			variant="outline" 
			class="w-full" 
			onclick={() => goto('/wallet/restore')}
		>
			Restore Wallet
		</Button>
	</div>
</form>

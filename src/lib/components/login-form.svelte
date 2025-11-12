<script lang="ts">
	import { onMount } from 'svelte';
	import { Label } from "$lib/components/ui/label/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.js';
	import { tauriWalletAPI } from '$lib/services/tauri-wallet-api.js';
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

	// Available wallets - from Tauri
	let wallets = $state<Array<{ value: string; label: string }>>([]);

	const triggerContent = $derived(
		wallets.find((w) => w.value === selectedWallet)?.label ?? "Select a wallet"
	);

	// Load wallets using Tauri command
	onMount(async () => {
		walletsLoading = true;
		errorMessage = '';

		try {
			const response = await tauriWalletAPI.listWallets();

			if (tauriWalletAPI.isSuccess(response)) {
				const data = tauriWalletAPI.unwrap(response);
				const walletNames = data.wallets || [];

				// Convert wallet names to the format expected by the Select component
				wallets = walletNames.map(name => ({
					value: name,
					label: name.charAt(0).toUpperCase() + name.slice(1)
				}));

				if (wallets.length === 0) {
					errorMessage = 'No wallets found. Please create a wallet first.';
				}
			} else {
				errorMessage = response.error || 'Failed to load wallets';
			}
		} catch (error) {
			const err = error instanceof Error ? error.message : String(error);
			errorMessage = `Failed to load wallets: ${err}`;
		} finally {
			walletsLoading = false;
		}
	});

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
			// Use auth store's login method which uses Tauri internally
			const result = await authStore.login(selectedWallet, password);

			if (result.success) {
				// Clear password from form
				password = '';

				// Navigate to main wallet interface
				await goto('/wallet/dashboard');
			} else {
				errorMessage = result.error || 'Login failed';
			}
		} catch (error) {
			const err = error instanceof Error ? error.message : String(error);
			errorMessage = `Authentication failed: ${err}`;
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

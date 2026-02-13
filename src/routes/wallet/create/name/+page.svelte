<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { walletCreationStore, type WalletCreationState } from '$lib/stores/wallet-creation.js';
	import { validateWalletCreationStep, getStepNumber, TOTAL_STEPS } from '$lib/utils/route-guards.js';
	import { tauriWalletAPI } from '$lib/services/tauri-wallet-api.js';

	let walletName = $state('');
	let error = $state('');
	let isLoading = $state(false);

	// Subscribe to store state
	let storeState = $state<WalletCreationState | null>(null);

	onMount(() => {
		// Initialize wallet creation flow
		walletCreationStore.startFlow();

		// Subscribe to store changes
		const unsubscribe = walletCreationStore.subscribe(state => {
			storeState = state;

			// Validate route access only when we have state
			if (storeState && !validateWalletCreationStep('name', storeState)) {
				return; // Route guard will handle redirect
			}
		});

		return unsubscribe;
	});

	// Check if wallet name already exists using Tauri
	async function checkWalletExists(name: string): Promise<boolean> {
		try {
			const response = await tauriWalletAPI.listWallets();

			if (!tauriWalletAPI.isSuccess(response)) {
				throw new Error(response.error || 'Failed to list wallets');
			}

			const data = tauriWalletAPI.unwrap(response);

			// Check if wallet name exists (case-sensitive)
			return data.wallets.includes(name);
		} catch (err) {
			console.error('Wallet list check failed:', err);
			throw new Error('Unable to check wallet names. Please try again.');
		}
	}

	async function handleNext() {
		error = '';

		// Validate wallet name
		const trimmedName = walletName.trim();
		if (!trimmedName) {
			error = 'Please enter a wallet name';
			return;
		}

		if (trimmedName.length < 3) {
			error = 'Wallet name must be at least 3 characters long';
			return;
		}

		if (trimmedName.length > 50) {
			error = 'Wallet name must be less than 50 characters long';
			return;
		}

		// Check for valid characters (alphanumeric, underscore, hyphen)
		if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
			error = 'Wallet name can only contain letters, numbers, underscore, and hyphen';
			return;
		}

		isLoading = true;
		walletCreationStore.setLoading(true);

		try {
			// Check for duplicate wallet name
			const exists = await checkWalletExists(trimmedName);

			if (exists) {
				error = 'Wallet name already exists. Please choose a different name.';
				return;
			}

			// Store wallet name and proceed
			walletCreationStore.setWalletName(trimmedName);
			await goto('/wallet/create/password');

		} catch (checkError) {
			if (checkError instanceof Error) {
				error = checkError.message;
			} else {
				error = 'An unexpected error occurred. Please try again.';
			}
		} finally {
			isLoading = false;
			walletCreationStore.setLoading(false);
		}
	}

	function handleBack() {
		walletCreationStore.cleanup();
		goto('/login');
	}

	// Handle form submission
	function handleSubmit(event: Event) {
		event.preventDefault();
		handleNext();
	}
</script>

<svelte:head>
	<title>Create Wallet - Name | Ocelot Wallet</title>
</svelte:head>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href="/login" class="flex items-center gap-2 font-medium">
				<div class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
					🪙
				</div>
				Ocelot Wallet
			</a>
		</div>
		
		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-xs">
				<div class="flex flex-col gap-6">
					<!-- Progress indicator -->
					<div class="flex flex-col items-center gap-2 text-center">
						<div class="text-sm text-muted-foreground">
							Step {getStepNumber('name')} of {TOTAL_STEPS}
						</div>
						<h1 class="text-2xl font-bold">Choose Wallet Name</h1>
						<p class="text-muted-foreground text-balance text-sm">
							Enter a unique name for your new wallet
						</p>
					</div>
					
					<!-- Form -->
					<form class="grid gap-6" onsubmit={handleSubmit}>
						<div class="grid gap-3">
							<Label for="walletName">Wallet Name</Label>
							<Input 
								id="walletName" 
								type="text" 
								bind:value={walletName}
								placeholder="Enter wallet name"
								required
								disabled={isLoading}
								autofocus
							/>
							<div class="text-xs text-muted-foreground">
								3-50 characters, letters, numbers, underscore, and hyphen only
							</div>
						</div>
						
						{#if error}
							<div class="text-red-500 text-sm text-center">
								{error}
							</div>
						{/if}
						
						<!-- Action buttons -->
						<div class="grid grid-cols-2 gap-3">
							<Button 
								type="button" 
								variant="outline" 
								onclick={handleBack}
								disabled={isLoading}
							>
								Back to Login
							</Button>
							<Button 
								type="submit" 
								disabled={isLoading || !walletName.trim()}
							>
								{#if isLoading}
									Checking...
								{:else}
									Next
								{/if}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
	<div class="bg-muted relative hidden lg:block">
		<!-- Decorative background -->
	</div>
</div>
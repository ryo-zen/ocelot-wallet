<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { walletCreationStore, type WalletCreationState } from '$lib/stores/wallet-creation.js';
	import { validateWalletCreationStep, getStepNumber, TOTAL_STEPS } from '$lib/utils/route-guards.js';
	import OcelotLogo from '$lib/components/ocelot-logo.svelte';
	import { tauriWalletAPI } from '$lib/services/tauri-wallet-api.js';

	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let isLoading = $state(false);

	// Subscribe to store state
	let storeState = $state<WalletCreationState | null>(null);

	onMount(() => {
		// Subscribe to store changes
		const unsubscribe = walletCreationStore.subscribe(state => {
			storeState = state;

			// Validate route access only when we have state
			if (storeState && !validateWalletCreationStep('password', storeState)) {
				return; // Route guard will handle redirect
			}
		});

		return unsubscribe;
	});

	async function handleNext() {
		if (!storeState) return;

		error = '';

		// Validate passwords
		if (!password) {
			error = 'Please enter a password';
			return;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters long';
			return;
		}

		if (password.length > 256) {
			error = 'Password must be less than 256 characters long';
			return;
		}

		if (!confirmPassword) {
			error = 'Please confirm your password';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		isLoading = true;
		walletCreationStore.setLoading(true);

		try {
			// Store password in wallet creation store
			walletCreationStore.setPassword(password);

			// Create the wallet via Tauri
			const response = await tauriWalletAPI.createWallet(storeState.walletName, password);

			if (tauriWalletAPI.isSuccess(response)) {
				const walletData = tauriWalletAPI.unwrap(response);

				// Store wallet creation result
				walletCreationStore.setWalletCreated(walletData.mnemonic, walletData.first_address);

				console.log(`Wallet ${storeState.walletName} created successfully with address: ${walletData.first_address}`);

				// Navigate to recovery phrase screen
				await goto('/wallet/create/recovery');
			} else {
				error = response.error || 'Wallet creation failed';
			}

		} catch (createError) {
			const err = createError instanceof Error ? createError.message : String(createError);
			error = `Wallet creation failed: ${err}`;

			// On error, redirect to login with cleanup
			setTimeout(() => {
				walletCreationStore.cleanup();
				goto('/login');
			}, 3000);

		} finally {
			isLoading = false;
			walletCreationStore.setLoading(false);
		}
	}

	function handleBack() {
		goto('/wallet/create/name');
	}

	// Handle form submission
	function handleSubmit(event: Event) {
		event.preventDefault();
		handleNext();
	}
</script>

<svelte:head>
	<title>Create Wallet - Password | Ocelot Wallet</title>
</svelte:head>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href="/login" class="flex items-center gap-2 font-medium">
				<OcelotLogo class="size-6" />
				Ocelot Wallet
			</a>
		</div>

		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-xs">
				<div class="flex flex-col gap-6">
					<!-- Progress indicator -->
					<div class="flex flex-col items-center gap-2 text-center">
						<div class="text-sm text-muted-foreground">
							Step {getStepNumber('password')} of {TOTAL_STEPS}
						</div>
						<h1 class="text-2xl font-bold">Set Password</h1>
						<p class="text-muted-foreground text-balance text-sm">
							{#if storeState}
								Create a secure password for wallet "{storeState.walletName}"
							{:else}
								Create a secure password for your wallet
							{/if}
						</p>
					</div>

					<!-- Form -->
					<form class="grid gap-6" onsubmit={handleSubmit}>
						<div class="grid gap-3">
							<Label for="password">Password</Label>
							<Input
								id="password"
								type="password"
								bind:value={password}
								placeholder="Enter password"
								required
								disabled={isLoading}
								autofocus
							/>
							<div class="text-xs text-muted-foreground">
								Minimum 8 characters required
							</div>
						</div>

						<div class="grid gap-3">
							<Label for="confirmPassword">Confirm Password</Label>
							<Input
								id="confirmPassword"
								type="password"
								bind:value={confirmPassword}
								placeholder="Confirm password"
								required
								disabled={isLoading}
							/>
						</div>

						{#if error}
							<div class="text-red-500 text-sm text-center">
								{error}
								{#if error.includes('redirect')}
									<div class="text-xs mt-1">
										Redirecting to login in 3 seconds...
									</div>
								{/if}
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
								Previous
							</Button>
							<Button
								type="submit"
								disabled={isLoading || !password || !confirmPassword}
							>
								{#if isLoading}
									Creating Wallet...
								{:else}
									Create Wallet
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

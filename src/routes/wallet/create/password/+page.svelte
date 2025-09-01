<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { walletCreationStore, type WalletCreationState } from '$lib/stores/wallet-creation.js';
	import { validateWalletCreationStep, getStepNumber, TOTAL_STEPS } from '$lib/utils/route-guards.js';

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

	// Create wallet via CLI Bridge
	async function createWallet(walletName: string, walletPassword: string) {
		try {
			const response = await fetch('http://127.0.0.1:8081/ws', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					command: 'wallet_create',
					wallet_name: walletName,
					password: walletPassword
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			
			if (!result.success) {
				throw new Error(result.error || 'Wallet creation failed');
			}
			
			return {
				mnemonic: result.mnemonic,
				firstAddress: result.first_address
			};
		} catch (fetchError) {
			console.error('Wallet creation failed:', fetchError);
			throw new Error('Unable to create wallet. Please try again.');
		}
	}

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
			
			// Create the wallet
			const walletData = await createWallet(storeState.walletName, password);
			
			// Store wallet creation result
			walletCreationStore.setWalletCreated(walletData.mnemonic, walletData.firstAddress);
			
			// Navigate to recovery phrase screen
			await goto('/wallet/create/recovery');
			
		} catch (createError) {
			if (createError instanceof Error) {
				if (createError.message.includes('Failed to fetch') || createError.message.includes('NetworkError')) {
					error = 'Unable to connect to wallet service. Please ensure the CLI Bridge is running on http://localhost:8081';
				} else if (createError.message.includes('Password setup failed') || createError.message.includes('too short')) {
					error = 'Password must be at least 8 characters long with valid characters';
				} else {
					error = createError.message;
				}
			} else {
				error = 'An unexpected error occurred during wallet creation';
			}
			
			// On error, redirect to login with cleanup
			setTimeout(() => {
				walletCreationStore.cleanup();
				goto('/login-02');
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
	<title>Create Wallet - Password | ZeiCoin Wallet</title>
</svelte:head>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href="/login-02" class="flex items-center gap-2 font-medium">
				<div class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
					🪙
				</div>
				ZeiCoin Wallet
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
		<img
			src="/placeholder.jpg"
			alt="placeholder"
			class="absolute inset-0 h-full w-full object-cover"
		/>
	</div>
</div>
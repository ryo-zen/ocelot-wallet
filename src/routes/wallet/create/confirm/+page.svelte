<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { walletCreationStore, type WalletCreationState } from '$lib/stores/wallet-creation.js';
	import { authStore } from '$lib/stores/auth.js';
	import { validateWalletCreationStep, getStepNumber, TOTAL_STEPS } from '$lib/utils/route-guards.js';
	import OcelotLogo from '$lib/components/ocelot-logo.svelte';

	let isLoading = $state(false);
	let isCompleting = $state(false);
	
	// Subscribe to store state
	let storeState = $state<WalletCreationState | null>(null);

	onMount(() => {
		// Subscribe to store changes
		const unsubscribe = walletCreationStore.subscribe(state => {
			storeState = state;
			
			// Validate route access only when we have state
			if (storeState && !validateWalletCreationStep('confirm', storeState)) {
				return; // Route guard will handle redirect
			}
		});

		return unsubscribe;
	});

	async function completeSetup() {
		if (!storeState) return;
		
		isCompleting = true;
		isLoading = true;
		
		try {
			// Auto-login to the newly created wallet
			authStore.login(storeState.walletName, storeState.password);
			
			// Complete wallet creation flow (clears sensitive data)
			walletCreationStore.complete();
			
			// Navigate to wallet dashboard
			await goto('/wallet/dashboard');
			
		} catch (error) {
			console.error('Auto-login failed:', error);
			
			// Fallback: redirect to login with success message
			walletCreationStore.cleanup();
			await goto('/login');
		}
	}

	function handleBack() {
		goto('/wallet/create/recovery');
	}

	// Format creation date
	function formatCreationDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Create Wallet - Confirmation | Ocelot Wallet</title>
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
			<div class="w-full max-w-md">
				<div class="flex flex-col gap-6">
					<!-- Progress indicator -->
					<div class="flex flex-col items-center gap-2 text-center">
						<div class="text-sm text-muted-foreground">
							Step {getStepNumber('confirm')} of {TOTAL_STEPS}
						</div>
						<h1 class="text-2xl font-bold">Wallet Created Successfully</h1>
						<p class="text-muted-foreground text-balance text-sm">
							Review your wallet details and complete setup
						</p>
					</div>
					
					<!-- Success indicator -->
					<div class="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
						<div class="text-green-600 text-4xl mb-2">✓</div>
						<h2 class="text-lg font-semibold text-green-800 mb-1">Wallet Created</h2>
						<p class="text-sm text-green-700">Your wallet has been successfully created and secured</p>
					</div>
					
					<!-- Wallet summary -->
					{#if storeState}
					<div class="bg-card border rounded-xl p-6">
						<h3 class="font-semibold mb-4">Wallet Summary</h3>
						<div class="space-y-4">
							<div class="flex justify-between items-start">
								<span class="text-sm text-muted-foreground">Wallet Name</span>
								<span class="font-medium text-right">{storeState.walletName}</span>
							</div>
							
							<div class="flex justify-between items-start">
								<span class="text-sm text-muted-foreground">Created</span>
								<span class="font-medium text-right text-sm">
									{formatCreationDate(storeState.creationDate)}
								</span>
							</div>
							
							<div class="pt-2 border-t border-border">
								<div class="space-y-2">
									<span class="text-sm text-muted-foreground">Your Wallet Address</span>
									<div class="font-mono text-xs bg-secondary text-secondary-foreground rounded p-3 break-all">
										{storeState.firstAddress}
									</div>
								</div>
							</div>
							
							<div class="pt-2 border-t border-border">
								<div class="space-y-2">
									<span class="text-sm text-muted-foreground">Recovery Phrase</span>
									<div class="text-xs text-green-600 bg-green-50 rounded p-2">
										✓ 12 words backed up and secured
									</div>
								</div>
							</div>
						</div>
					</div>
					{/if}
					
					<!-- Important reminders -->
					<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
						<h3 class="font-semibold text-blue-800 mb-2">Important Reminders</h3>
						<div class="text-sm text-blue-700 space-y-1">
							<p>• Your recovery phrase is the only way to restore this wallet</p>
							<p>• Keep your password and recovery phrase secure</p>
							<p>• Never share these with anyone</p>
							<p>• Consider storing backups in multiple secure locations</p>
						</div>
					</div>
					
					<!-- Action buttons -->
					<div class="space-y-3">
						{#if isCompleting}
							<div class="bg-card border rounded-xl p-6 text-center">
								<div class="space-y-2">
									<div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
									<p class="text-sm text-muted-foreground">Setting up your wallet...</p>
								</div>
							</div>
						{:else}
							<Button 
								type="button"
								class="w-full"
								onclick={completeSetup}
								disabled={isLoading}
							>
								Complete Setup & Access Wallet
							</Button>
							
							<Button 
								type="button" 
								variant="outline" 
								class="w-full"
								onclick={handleBack}
								disabled={isLoading}
							>
								Back to Recovery Phrase
							</Button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="bg-muted relative hidden lg:block">
		<!-- Decorative background -->
	</div>
</div>
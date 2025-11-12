<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { walletCreationStore, type WalletCreationState } from '$lib/stores/wallet-creation.js';
	import { validateWalletCreationStep, getStepNumber, TOTAL_STEPS } from '$lib/utils/route-guards.js';

	let isLoading = $state(false);
	let storeState = $state<WalletCreationState | null>(null);

	onMount(() => {
		// Subscribe to store changes
		const unsubscribe = walletCreationStore.subscribe(state => {
			storeState = state;
			
			// Validate route access only when we have state
			if (storeState && !validateWalletCreationStep('recovery', storeState)) {
				return; // Route guard will handle redirect
			}
		});

		return unsubscribe;
	});

	function handleNext() {
		goto('/wallet/create/confirm');
	}

	function handleBack() {
		goto('/wallet/create/password');
	}

	function openPrintTemplate() {
		if (!storeState) return;
		
		// Open print template in new window
		const printWindow = window.open('/wallet/create/print-template', '_blank', 'width=800,height=600');
		if (printWindow) {
			// Pass mnemonic data to print window via localStorage (temporary)
			const printData = {
				walletName: storeState.walletName,
				mnemonic: storeState.mnemonic.join(' '),
				firstAddress: storeState.firstAddress,
				creationDate: storeState.creationDate.toISOString()
			};
			
			localStorage.setItem('wallet_print_data', JSON.stringify(printData));
			
			// Clean up print data after 1 minute
			setTimeout(() => {
				localStorage.removeItem('wallet_print_data');
			}, 60 * 1000);
		}
	}

	// Format mnemonic for display in 3x4 grid
	function getMnemonicGrid(): string[][] {
		if (!storeState?.mnemonic) return [];
		
		const words = storeState.mnemonic;
		const grid: string[][] = [];
		
		for (let i = 0; i < 4; i++) {
			const row: string[] = [];
			for (let j = 0; j < 3; j++) {
				const index = i * 3 + j;
				if (index < words.length) {
					row.push(`${index + 1}. ${words[index]}`);
				}
			}
			grid.push(row);
		}
		
		return grid;
	}

	const mnemonicGrid = $derived(getMnemonicGrid());
</script>

<svelte:head>
	<title>Create Wallet - Recovery Phrase | ZeiCoin Wallet</title>
</svelte:head>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href="/login" class="flex items-center gap-2 font-medium">
				<div class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
					🪙
				</div>
				ZeiCoin Wallet
			</a>
		</div>
		
		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-md">
				<div class="flex flex-col gap-6">
					<!-- Progress indicator -->
					<div class="flex flex-col items-center gap-2 text-center">
						<div class="text-sm text-muted-foreground">
							Step {getStepNumber('recovery')} of {TOTAL_STEPS}
						</div>
						<h1 class="text-2xl font-bold">Your Recovery Phrase</h1>
						<p class="text-muted-foreground text-balance text-sm">
							Write down these 12 words in the exact order shown
						</p>
					</div>
					
					<!-- Wallet info -->
					{#if storeState}
					<div class="bg-card border rounded-xl p-4">
						<div class="space-y-2">
							<div class="flex justify-between items-center">
								<span class="text-sm text-muted-foreground">Wallet Name</span>
								<span class="font-medium">{storeState.walletName}</span>
							</div>
							<div class="flex justify-between items-center">
								<span class="text-sm text-muted-foreground">Created</span>
								<span class="font-medium text-sm">
									{storeState.creationDate.toLocaleDateString()} {storeState.creationDate.toLocaleTimeString()}
								</span>
							</div>
						</div>
					</div>
					{/if}
					
					<!-- Recovery phrase grid -->
					{#if storeState && mnemonicGrid.length > 0}
					<div class="bg-card border rounded-xl p-6">
						<div class="space-y-4">
							{#each mnemonicGrid as row}
								<div class="grid grid-cols-3 gap-4">
									{#each row as wordEntry}
										<div class="bg-secondary rounded-lg p-3 text-center">
											<span class="font-mono text-sm">{wordEntry}</span>
										</div>
									{/each}
								</div>
							{/each}
						</div>
					</div>
					{/if}
					
					<!-- Warning message -->
					<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
						<div class="space-y-2">
							<h3 class="font-semibold text-yellow-800">IMPORTANT - Store Securely</h3>
							<div class="text-sm text-yellow-700 space-y-1">
								<p>• Write these words on paper and store in a safe place</p>
								<p>• Never share your recovery phrase with anyone</p>
								<p>• These words can restore your wallet if lost</p>
								<p>• Keep multiple copies in separate secure locations</p>
							</div>
						</div>
					</div>
					
					<!-- First address display -->
					{#if storeState}
					<div class="bg-card border rounded-xl p-4">
						<div class="space-y-2">
							<h3 class="font-semibold text-sm">First Wallet Address</h3>
							<div class="font-mono text-xs break-all bg-secondary rounded p-2">
								{storeState.firstAddress}
							</div>
						</div>
					</div>
					{/if}
					
					<!-- Action buttons -->
					<div class="space-y-3">
						<Button 
							type="button" 
							variant="outline" 
							class="w-full"
							onclick={openPrintTemplate}
						>
							Print Template
						</Button>
						
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
								type="button"
								onclick={handleNext}
								disabled={isLoading}
							>
								Continue
							</Button>
						</div>
					</div>
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
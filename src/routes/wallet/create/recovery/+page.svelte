<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { walletCreationStore, type WalletCreationState } from '$lib/stores/wallet-creation.js';
	import { validateWalletCreationStep, getStepNumber, TOTAL_STEPS } from '$lib/utils/route-guards.js';
	import { save } from '@tauri-apps/plugin-dialog';
	import { invoke } from '@tauri-apps/api/core';
	import { writeTextFile } from '@tauri-apps/plugin-fs';

	let isLoading = $state(false);
	let storeState = $state<WalletCreationState | null>(null);
	let isDownloading = $state(false);

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

	async function downloadEncryptedBackup() {
		if (!storeState || !storeState.password) return;

		try {
			isDownloading = true;

			// Get encrypted backup content from Tauri
			const response = await invoke<{success: boolean, data?: string, error?: string}>('create_encrypted_backup', {
				walletName: storeState.walletName,
				password: storeState.password,
				mnemonic: storeState.mnemonic.join(' ')
			});

			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to create backup');
			}

			// Show save dialog
			const filePath = await save({
				defaultPath: `${storeState.walletName}_backup.zeibackup`,
				filters: [{
					name: 'ZeiCoin Backup',
					extensions: ['zeibackup']
				}]
			});

			if (filePath) {
				// Write file
				await writeTextFile(filePath, response.data);
				alert('Encrypted backup file saved successfully!');
			}
		} catch (error) {
			console.error('Failed to create encrypted backup:', error);
			alert(`Failed to create encrypted backup: ${error}`);
		} finally {
			isDownloading = false;
		}
	}

	async function downloadPlaintextBackup() {
		if (!storeState || !storeState.password) return;

		try {
			isDownloading = true;

			// Get plaintext backup content from Tauri
			const response = await invoke<{success: boolean, data?: string, error?: string}>('create_plaintext_backup', {
				walletName: storeState.walletName,
				password: storeState.password,
				mnemonic: storeState.mnemonic.join(' ')
			});

			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to create backup');
			}

			// Show save dialog
			const filePath = await save({
				defaultPath: `${storeState.walletName}_backup.txt`,
				filters: [{
					name: 'Text File',
					extensions: ['txt']
				}]
			});

			if (filePath) {
				// Write file
				await writeTextFile(filePath, response.data);
				alert('Plain text backup file saved successfully!\n\nIMPORTANT: This file contains your unencrypted recovery phrase. Store it securely and delete it from your computer after backing up offline.');
			}
		} catch (error) {
			console.error('Failed to create plaintext backup:', error);
			alert(`Failed to create plaintext backup: ${error}`);
		} finally {
			isDownloading = false;
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
					
					<!-- Backup download options -->
					<div class="bg-card border rounded-xl p-4 space-y-3">
						<h3 class="font-semibold text-sm">Save Recovery Information</h3>
						<p class="text-xs text-muted-foreground">
							Save your recovery phrase for safekeeping. Choose encrypted (recommended) or plain text.
						</p>

						<div class="space-y-2">
							<!-- Encrypted backup (recommended) -->
							<Button
								type="button"
								variant="default"
								class="w-full"
								onclick={downloadEncryptedBackup}
								disabled={isDownloading || isLoading}
							>
								{isDownloading ? 'Downloading...' : 'Download Encrypted Backup (.zeibackup)'}
							</Button>
							<p class="text-xs text-muted-foreground px-1">
								✓ Recommended - Protected by wallet password, safe to store on USB/cloud
							</p>

							<!-- Plain text backup -->
							<Button
								type="button"
								variant="outline"
								class="w-full"
								onclick={downloadPlaintextBackup}
								disabled={isDownloading || isLoading}
							>
								Download Plain Text (.txt)
							</Button>
							<p class="text-xs text-yellow-700 px-1">
								⚠ Advanced - Unencrypted, must be stored securely offline only
							</p>
						</div>
					</div>

					<!-- Navigation buttons -->
					<div class="grid grid-cols-2 gap-3">
						<Button
							type="button"
							variant="outline"
							onclick={handleBack}
							disabled={isLoading || isDownloading}
						>
							Previous
						</Button>
						<Button
							type="button"
							onclick={handleNext}
							disabled={isLoading || isDownloading}
						>
							Continue
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="bg-muted relative hidden lg:block">
		<!-- Decorative background -->
	</div>
</div>
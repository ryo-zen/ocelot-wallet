<script lang="ts">
	import { goto } from '$app/navigation';
	import { Label } from "$lib/components/ui/label/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Tabs, TabsList, TabsTrigger, TabsContent } from "$lib/components/ui/tabs/index.js";
	import MnemonicInput from '$lib/components/mnemonic-input.svelte';
	import { tauriWalletAPI } from '$lib/services/tauri-wallet-api.js';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readTextFile } from '@tauri-apps/plugin-fs';
	import { invoke } from '@tauri-apps/api/core';

	// Manual entry state
	let mnemonicWords = $state(Array(12).fill(''));
	let walletName = $state('');
	let password = $state('');
	let confirmPassword = $state('');

	// File upload state
	let uploadedFileName = $state('');
	let fileContent = $state('');
	let backupPassword = $state('');

	// Common state
	let isLoading = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

	// Form validation for manual entry
	function validateManualForm(): string | null {
		if (!walletName.trim()) {
			return 'Please enter a wallet name';
		}

		if (walletName.trim().length < 2) {
			return 'Wallet name must be at least 2 characters';
		}

		const validWords = mnemonicWords.filter(word => word.trim().length > 0);
		if (validWords.length !== 12) {
			return 'Please enter all 12 mnemonic words';
		}

		if (!password) {
			return 'Please enter a password';
		}

		if (password.length < 8) {
			return 'Password must be at least 8 characters';
		}

		if (password !== confirmPassword) {
			return 'Passwords do not match';
		}

		return null;
	}

	// Form validation for file upload
	function validateFileForm(): string | null {
		if (!fileContent) {
			return 'Please select a backup file';
		}

		if (!walletName.trim()) {
			return 'Please enter a wallet name';
		}

		if (walletName.trim().length < 2) {
			return 'Wallet name must be at least 2 characters';
		}

		if (!backupPassword) {
			return 'Please enter the original wallet password';
		}

		if (!password) {
			return 'Please enter a new password';
		}

		if (password.length < 8) {
			return 'Password must be at least 8 characters';
		}

		if (password !== confirmPassword) {
			return 'Passwords do not match';
		}

		return null;
	}

	// Handle manual restore
	async function handleManualRestore(event: Event) {
		event.preventDefault();

		const validation = validateManualForm();
		if (validation) {
			errorMessage = validation;
			return;
		}

		isLoading = true;
		errorMessage = '';
		successMessage = '';

		try {
			const mnemonic = mnemonicWords.join(' ').toLowerCase();
			const response = await tauriWalletAPI.restoreWallet(walletName.trim(), mnemonic, password);

			if (tauriWalletAPI.isSuccess(response)) {
				successMessage = `Wallet "${walletName}" restored successfully!`;

				// Clear sensitive data
				mnemonicWords = Array(12).fill('');
				password = '';
				confirmPassword = '';

				// Redirect to login after short delay
				setTimeout(() => {
					goto('/login');
				}, 2000);
			} else {
				errorMessage = response.error || 'Wallet restoration failed';
			}
		} catch (error) {
			const err = error instanceof Error ? error.message : String(error);
			errorMessage = `Restoration failed: ${err}`;
		} finally {
			isLoading = false;
		}
	}

	// Handle file upload
	async function handleFileUpload() {
		try {
			const selected = await open({
				multiple: false,
				filters: [{
					name: 'Encrypted Backup',
					extensions: ['zeibackup']
				}]
			});

			if (selected) {
				const filePath = selected;
				uploadedFileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';

				fileContent = await readTextFile(filePath);

				errorMessage = '';
			}
		} catch (error) {
			const err = error instanceof Error ? error.message : String(error);
			errorMessage = `Failed to read file: ${err}`;
		}
	}

	// Handle file restore
	async function handleFileRestore(event: Event) {
		event.preventDefault();

		const validation = validateFileForm();
		if (validation) {
			errorMessage = validation;
			return;
		}

		isLoading = true;
		errorMessage = '';
		successMessage = '';

		try {
			// Restore from encrypted backup
			const response = await invoke<{success: boolean, data?: any, error?: string}>('restore_from_encrypted_backup', {
				backupJson: fileContent,
				password: backupPassword,
				newWalletName: walletName.trim(),
				newPassword: password
			});

			if (response.success) {
				successMessage = `Wallet "${walletName}" restored successfully from backup file!`;

				// Clear sensitive data
				fileContent = '';
				uploadedFileName = '';
				backupPassword = '';
				password = '';
				confirmPassword = '';

				// Redirect to login after short delay
				setTimeout(() => {
					goto('/login');
				}, 2000);
			} else {
				errorMessage = response.error || 'Wallet restoration failed';
			}
		} catch (error) {
			const err = error instanceof Error ? error.message : String(error);
			errorMessage = `Restoration failed: ${err}`;
		} finally {
			isLoading = false;
		}
	}

	// Clear manual form
	function clearManualForm() {
		mnemonicWords = Array(12).fill('');
		walletName = '';
		password = '';
		confirmPassword = '';
		errorMessage = '';
		successMessage = '';
	}

	// Clear file form
	function clearFileForm() {
		uploadedFileName = '';
		fileContent = '';
		backupPassword = '';
		walletName = '';
		password = '';
		confirmPassword = '';
		errorMessage = '';
		successMessage = '';
	}
</script>

<svelte:head>
	<title>Restore Wallet | Ocelot Wallet</title>
</svelte:head>

<div class="min-h-screen bg-background p-4">
	<div class="max-w-2xl mx-auto">
		<div class="space-y-8">
			<!-- Header -->
			<div class="text-center space-y-2">
				<h1 class="text-2xl font-bold">Restore Wallet</h1>
				<p class="text-muted-foreground">
					Restore your wallet from a backup file or recovery phrase
				</p>
			</div>

			<!-- Tabs -->
			<Tabs value="manual" class="w-full">
				<TabsList class="grid w-full grid-cols-2">
					<TabsTrigger value="manual">Recovery Phrase</TabsTrigger>
					<TabsTrigger value="file">Backup File</TabsTrigger>
				</TabsList>

				<!-- Manual Entry Tab -->
				<TabsContent value="manual">
					<form onsubmit={handleManualRestore} class="space-y-6 mt-6">
						<!-- Mnemonic Input Section -->
						<div class="bg-card border rounded-xl p-6">
							<div class="space-y-4">
								<div class="space-y-2">
									<Label class="text-lg font-semibold">Seed Phrase</Label>
									<p class="text-sm text-muted-foreground">
										Enter your 12-word mnemonic seed phrase in the correct order
									</p>
								</div>
								<MnemonicInput bind:words={mnemonicWords} disabled={isLoading} />
							</div>
						</div>

						<!-- Wallet Details Section -->
						<div class="bg-card border rounded-xl p-6">
							<div class="space-y-6">
								<h2 class="text-lg font-semibold">Wallet Details</h2>

								<div class="grid gap-6">
									<div class="space-y-2">
										<Label for="walletName">Wallet Name</Label>
										<Input
											id="walletName"
											type="text"
											bind:value={walletName}
											placeholder="Enter wallet name"
											disabled={isLoading}
											required
										/>
									</div>

									<div class="space-y-2">
										<Label for="password">New Password</Label>
										<Input
											id="password"
											type="password"
											bind:value={password}
											placeholder="Enter password (min 8 characters)"
											disabled={isLoading}
											required
										/>
									</div>

									<div class="space-y-2">
										<Label for="confirmPassword">Confirm Password</Label>
										<Input
											id="confirmPassword"
											type="password"
											bind:value={confirmPassword}
											placeholder="Confirm password"
											disabled={isLoading}
											required
										/>
									</div>
								</div>
							</div>
						</div>

						<!-- Actions -->
						<div class="flex gap-4">
							<Button
								type="button"
								variant="outline"
								onclick={clearManualForm}
								disabled={isLoading}
							>
								Clear Form
							</Button>

							<Button
								type="submit"
								class="flex-1"
								disabled={isLoading}
							>
								{#if isLoading}
									Restoring Wallet...
								{:else}
									Restore Wallet
								{/if}
							</Button>
						</div>
					</form>
				</TabsContent>

				<!-- File Upload Tab -->
				<TabsContent value="file">
					<form onsubmit={handleFileRestore} class="space-y-6 mt-6">
						<!-- File Selection -->
						<div class="bg-card border rounded-xl p-6">
							<div class="space-y-4">
								<div class="space-y-2">
									<Label class="text-lg font-semibold">Backup File</Label>
									<p class="text-sm text-muted-foreground">
										Select your encrypted .zeibackup file
									</p>
								</div>

								<Button
									type="button"
									variant="outline"
									class="w-full"
									onclick={handleFileUpload}
									disabled={isLoading}
								>
									{uploadedFileName ? `Selected: ${uploadedFileName}` : 'Choose Backup File'}
								</Button>

								{#if uploadedFileName}
									<div class="bg-secondary rounded-lg p-3 text-sm">
										<div class="flex items-center justify-between">
											<span class="font-medium">{uploadedFileName}</span>
											<span class="text-muted-foreground">(Encrypted)</span>
										</div>
									</div>
								{/if}
							</div>
						</div>

						<!-- Wallet Details -->
						<div class="bg-card border rounded-xl p-6">
							<div class="space-y-6">
								<h2 class="text-lg font-semibold">Wallet Details</h2>

								<div class="grid gap-6">
									<div class="space-y-2">
										<Label for="backupPassword">Original Wallet Password</Label>
										<Input
											id="backupPassword"
											type="password"
											bind:value={backupPassword}
											placeholder="Password used to create this backup"
											disabled={isLoading}
											required
										/>
										<p class="text-xs text-muted-foreground">
											Enter the password you used when creating this wallet
										</p>
									</div>

									<div class="space-y-2">
										<Label for="fileWalletName">New Wallet Name</Label>
										<Input
											id="fileWalletName"
											type="text"
											bind:value={walletName}
											placeholder="Enter wallet name"
											disabled={isLoading}
											required
										/>
									</div>

									<div class="space-y-2">
										<Label for="filePassword">New Password</Label>
										<Input
											id="filePassword"
											type="password"
											bind:value={password}
											placeholder="Enter new password (min 8 characters)"
											disabled={isLoading}
											required
										/>
									</div>

									<div class="space-y-2">
										<Label for="fileConfirmPassword">Confirm New Password</Label>
										<Input
											id="fileConfirmPassword"
											type="password"
											bind:value={confirmPassword}
											placeholder="Confirm new password"
											disabled={isLoading}
											required
										/>
									</div>
								</div>
							</div>
						</div>

						<!-- Actions -->
						<div class="flex gap-4">
							<Button
								type="button"
								variant="outline"
								onclick={clearFileForm}
								disabled={isLoading}
							>
								Clear Form
							</Button>

							<Button
								type="submit"
								class="flex-1"
								disabled={isLoading || !fileContent}
							>
								{#if isLoading}
									Restoring Wallet...
								{:else}
									Restore from File
								{/if}
							</Button>
						</div>
					</form>
				</TabsContent>
			</Tabs>

			<!-- Messages -->
			{#if errorMessage}
				<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-medium">
					{errorMessage}
				</div>
			{/if}

			{#if successMessage}
				<div class="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 font-medium">
					{successMessage}
				</div>
			{/if}

			<!-- Back to Login -->
			<div class="text-center">
				<Button
					type="button"
					variant="link"
					onclick={() => goto('/login')}
					disabled={isLoading}
				>
					Back to Login
				</Button>
			</div>
		</div>
	</div>
</div>

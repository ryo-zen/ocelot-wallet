<script lang="ts">
	import { goto } from '$app/navigation';
	import { Label } from "$lib/components/ui/label/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import MnemonicInput from '$lib/components/mnemonic-input.svelte';
	import { authStore } from '$lib/stores/auth.js';
	
	let mnemonicWords = Array(12).fill('');
	let walletName = '';
	let password = '';
	let confirmPassword = '';
	let isLoading = false;
	let errorMessage = '';
	let successMessage = '';
	
	// Restore wallet function
	async function restoreWalletFromSeed(name: string, mnemonic: string, password: string): Promise<{ success: boolean; error?: string; message?: string }> {
		try {
			const response = await fetch('http://127.0.0.1:8081/ws', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					command: 'wallet_restore',
					wallet_name: name,
					mnemonic: mnemonic,
					password: password
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			return result;
		} catch (error) {
			throw error;
		}
	}
	
	// Form validation
	function validateForm(): string | null {
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
		
		if (password.length < 6) {
			return 'Password must be at least 6 characters';
		}
		
		if (password !== confirmPassword) {
			return 'Passwords do not match';
		}
		
		return null;
	}
	
	// Handle form submission
	async function handleRestore(event: Event) {
		event.preventDefault();
		
		const validation = validateForm();
		if (validation) {
			errorMessage = validation;
			return;
		}
		
		isLoading = true;
		errorMessage = '';
		successMessage = '';
		
		try {
			const mnemonic = mnemonicWords.join(' ').toLowerCase();
			const result = await restoreWalletFromSeed(walletName.trim(), mnemonic, password);
			
			if (result.success) {
				successMessage = `Wallet "${walletName}" restored successfully!`;
				
				// Clear sensitive data
				mnemonicWords = Array(12).fill('');
				password = '';
				confirmPassword = '';
				
				// Redirect to login after short delay
				setTimeout(() => {
					goto('/login-02');
				}, 2000);
			} else {
				errorMessage = result.error || 'Wallet restoration failed';
			}
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
					errorMessage = 'Unable to connect to wallet service. Please ensure the CLI Bridge is running.';
				} else {
					errorMessage = `Restoration failed: ${error.message}`;
				}
			} else {
				errorMessage = 'An unexpected error occurred during restoration';
			}
		} finally {
			isLoading = false;
		}
	}
	
	// Clear form
	function clearForm() {
		mnemonicWords = Array(12).fill('');
		walletName = '';
		password = '';
		confirmPassword = '';
		errorMessage = '';
		successMessage = '';
	}
</script>

<svelte:head>
	<title>Restore Wallet - Zii Wallet</title>
</svelte:head>

<div class="min-h-screen bg-background p-4">
	<div class="max-w-2xl mx-auto">
		<form onsubmit={handleRestore} class="space-y-8">
			<!-- Header -->
			<div class="text-center space-y-2">
				<h1 class="text-2xl font-bold">Restore Wallet</h1>
				<p class="text-muted-foreground">
					Enter your 12-word seed phrase to restore your wallet
				</p>
			</div>
			
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
							<Label for="password">Password</Label>
							<Input 
								id="password"
								type="password"
								bind:value={password}
								placeholder="Enter password"
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
			
			<!-- Actions -->
			<div class="flex gap-4">
				<Button 
					type="button" 
					variant="outline" 
					class="flex-1"
					onclick={() => goto('/login-02')}
					disabled={isLoading}
				>
					Back to Login
				</Button>
				
				<Button 
					type="button" 
					variant="outline" 
					onclick={clearForm}
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
	</div>
</div>
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let printData: {
		walletName: string;
		mnemonic: string;
		firstAddress: string;
		creationDate: string;
	} | null = $state(null);
	
	let isLoading = $state(true);
	let error = $state('');

	onMount(() => {
		// Get print data from localStorage (set by recovery page)
		const storedData = localStorage.getItem('wallet_print_data');
		
		if (storedData) {
			try {
				printData = JSON.parse(storedData);
				isLoading = false;
				
				// Clear the data from localStorage immediately for security
				localStorage.removeItem('wallet_print_data');
			} catch (parseError) {
				console.error('Failed to parse print data:', parseError);
				error = 'Invalid print data';
				isLoading = false;
			}
		} else {
			error = 'No print data available';
			isLoading = false;
		}
	});

	function handlePrint() {
		window.print();
	}

	function handleClose() {
		window.close();
	}

	// Format mnemonic into numbered grid
	function getMnemonicGrid(): string[] {
		if (!printData) return [];
		
		const words = printData.mnemonic.split(' ');
		return words.map((word, index) => `${index + 1}. ${word}`);
	}

	// Format creation date
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const mnemonicGrid = $derived(getMnemonicGrid());
</script>

<svelte:head>
	<title>Wallet Recovery Phrase - Print Template</title>
	<style>
		@media print {
			body { margin: 0; }
			.no-print { display: none !important; }
			.print-only { display: block !important; }
			
			/* Optimize for 2-page layout */
			* {
				-webkit-print-color-adjust: exact !important;
				color-adjust: exact !important;
			}
			
			/* Control page breaks */
			.wallet-section {
				page-break-inside: avoid;
				break-inside: avoid;
			}
			
			/* Force page break after recovery phrase */
			.recovery-section {
				page-break-after: always;
			}
			
			/* Optimize spacing for 2 pages */
			.print-container {
				margin: 0;
				padding: 1rem;
			}
		}
		@media screen {
			.print-only { display: none; }
		}
	</style>
</svelte:head>

{#if isLoading}
	<div class="min-h-screen flex items-center justify-center">
		<div class="text-center space-y-4">
			<div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
			<p>Loading print template...</p>
		</div>
	</div>
{:else if error}
	<div class="min-h-screen flex items-center justify-center">
		<div class="text-center space-y-4">
			<h1 class="text-2xl font-bold text-red-600">Error</h1>
			<p class="text-red-500">{error}</p>
			<Button onclick={handleClose}>Close</Button>
		</div>
	</div>
{:else if printData}
	<!-- Print controls (hidden when printing) -->
	<div class="no-print fixed top-4 right-4 space-x-2 z-10">
		<Button onclick={handlePrint}>Print</Button>
		<Button variant="outline" onclick={handleClose}>Close</Button>
	</div>

	<!-- Printable content -->
	<div class="max-w-4xl mx-auto p-8 bg-white min-h-screen print:min-h-0 print-container">
		<!-- Header with watermark -->
		<div class="mb-8">
			<div class="flex justify-end mb-4">
				<div class="text-xs text-red-600 font-semibold border border-red-300 rounded px-2 py-1 bg-red-50">
					CONFIDENTIAL - STORE SECURELY
				</div>
			</div>
			<div class="text-center">
				<h1 class="text-3xl font-bold mb-2 text-black">ZeiCoin Wallet Recovery Information</h1>
				<p class="text-black">Keep this information secure and private</p>
			</div>
		</div>

		<!-- Wallet information -->
		<div class="mb-8 wallet-section">
			<h2 class="text-xl font-semibold mb-4 border-b border-gray-300 pb-2 text-black">Wallet Details</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
				<div>
					<span class="font-medium text-black">Wallet Name:</span>
					<div class="mt-1 p-2 bg-gray-50 border rounded font-mono text-black">
						{printData.walletName}
					</div>
				</div>
				<div>
					<span class="font-medium text-black">Created:</span>
					<div class="mt-1 p-2 bg-gray-50 border rounded text-black">
						{formatDate(printData.creationDate)}
					</div>
				</div>
			</div>
			<div>
				<span class="font-medium text-black">First Wallet Address:</span>
				<div class="mt-1 p-2 bg-gray-50 border rounded">
					<span class="font-mono text-sm break-all text-black">{printData.firstAddress}</span>
				</div>
			</div>
		</div>

		<!-- Recovery phrase -->
		<div class="mb-8 recovery-section">
			<h2 class="text-xl font-semibold mb-4 border-b border-gray-300 pb-2 text-black">
				Recovery Phrase (12 Words)
			</h2>
			<div class="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
				<div class="grid grid-cols-3 gap-4 mb-4">
					{#each mnemonicGrid as word}
						<div class="bg-white border border-gray-300 rounded p-3 text-center">
							<span class="font-mono text-lg text-black">{word}</span>
						</div>
					{/each}
				</div>
				<div class="text-sm text-yellow-800 bg-yellow-100 rounded p-3">
					<strong>IMPORTANT:</strong> Write these words in the exact order shown. 
					These 12 words can restore your entire wallet. Never share them with anyone.
				</div>
			</div>
		</div>


		<!-- Security instructions -->
		<div class="mb-8">
			<h2 class="text-xl font-semibold mb-4 border-b border-gray-300 pb-2 text-black">Security Instructions</h2>
			<div class="bg-red-50 border-2 border-red-200 rounded-lg p-6">
				<div class="space-y-3">
					<h3 class="font-semibold text-red-800">Critical Security Guidelines:</h3>
					<ul class="space-y-2 text-red-700">
						<li class="flex items-start">
							<span class="font-bold mr-2">1.</span>
							<span>Store this document in a secure, private location (safe, bank deposit box, etc.)</span>
						</li>
						<li class="flex items-start">
							<span class="font-bold mr-2">2.</span>
							<span>Never photograph or digitally store your recovery phrase</span>
						</li>
						<li class="flex items-start">
							<span class="font-bold mr-2">3.</span>
							<span>Never share your recovery phrase with anyone, including support staff</span>
						</li>
						<li class="flex items-start">
							<span class="font-bold mr-2">4.</span>
							<span>Consider making multiple copies and storing them in separate secure locations</span>
						</li>
						<li class="flex items-start">
							<span class="font-bold mr-2">5.</span>
							<span>If this document is lost or compromised, immediately transfer funds to a new wallet</span>
						</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- Recovery instructions -->
		<div class="mb-8">
			<h2 class="text-xl font-semibold mb-4 border-b border-gray-300 pb-2 text-black">Wallet Recovery Instructions</h2>
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
				<div class="space-y-3">
					<p class="text-blue-800">
						<strong>To restore your wallet:</strong>
					</p>
					<ol class="space-y-2 text-blue-700">
						<li>1. Install ZeiCoin wallet software</li>
						<li>2. Select "Import/Restore Wallet" option</li>
						<li>3. Enter the 12 recovery words in the exact order shown above</li>
						<li>4. Set a new password for the restored wallet</li>
						<li>5. Your wallet and all funds will be restored</li>
					</ol>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="border-t border-gray-300 pt-4 text-center text-sm text-black">
			<p>ZeiCoin Wallet Recovery Template</p>
			<p>Generated: {formatDate(printData.creationDate)}</p>
			<div class="mt-2 text-xs text-red-600 font-semibold">
				CONFIDENTIAL DOCUMENT - HANDLE WITH EXTREME CARE
			</div>
		</div>

	</div>
{/if}
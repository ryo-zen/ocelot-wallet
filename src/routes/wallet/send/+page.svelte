<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { authStore } from "$lib/stores/auth.js";
	import { tauriWalletAPI } from "$lib/services/tauri-wallet-api.js";
	import { serverConfigStore } from "$lib/stores/server-config.js";
	import { get } from "svelte/store";
	import { onMount } from "svelte";

	// Send components
	import SendForm from '$lib/components/send/SendForm.svelte';
	import ConfirmDialog from '$lib/components/send/ConfirmDialog.svelte';
	import { sendTransaction, validateTransaction, type TransactionData } from '$lib/components/send/send-transaction.js';

	let recipient = $state('');
	let amount = $state('');
	let message = $state('');
	let category = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let success = $state('');
	let showConfirmDialog = $state(false);
	let currentBalance = $state('0');

	onMount(() => {
		// Read URL parameters
		const urlParams = new URLSearchParams(window.location.search);
		const toParam = urlParams.get('to');
		if (toParam) {
			recipient = toParam;
		}

		getBalance();
	});

	async function getBalance() {
		const sessionRefreshed = authStore.refreshSession();
		if (!sessionRefreshed) return;

		const credentials = authStore.getCredentials();
		if (!credentials.wallet) return;

		try {
			// Get address from auth store
			const storeState = get(authStore);
			const address = storeState.address;

			if (!address) {
				console.error('No address in auth store');
				return;
			}

			// Get RPC URL from server config
			const rpcUrl = serverConfigStore.getCurrentRpcUrl();

			// Fetch balance via Tauri
			const response = await tauriWalletAPI.getBalance(address, rpcUrl);

			if (tauriWalletAPI.isSuccess(response)) {
				const data = tauriWalletAPI.unwrap(response);
				// Convert from base units to ZEI (1 ZEI = 100,000,000 base units)
				const balanceNum = parseFloat(data.balance) / 100_000_000;
				currentBalance = balanceNum.toString();
				authStore.refreshSession();
			}
		} catch (err) {
			console.error('Failed to get balance:', err);
		}
	}

	function handleSend() {
		console.log('handleSend called', { recipient, amount, currentBalance });
		error = '';
		success = '';

		const validation = validateTransaction(recipient, amount, currentBalance);
		console.log('Validation result:', validation);
		if (!validation.valid) {
			error = validation.error || 'Validation failed';
			return;
		}

		showConfirmDialog = true;
	}

	async function executeSend() {
		showConfirmDialog = false;
		isLoading = true;
		error = '';
		success = '';

		const credentials = authStore.getCredentials();
		if (!credentials.wallet || !credentials.password) {
			error = 'Not authenticated';
			isLoading = false;
			return;
		}

		const transactionData: TransactionData = {
			recipient,
			amount,
			message,
			category,
			};

		// Type-safe credentials (already validated above)
		const validCredentials = {
			wallet: credentials.wallet,
			password: credentials.password
		};

		const result = await sendTransaction(validCredentials, transactionData);

		if (result.success && result.txHash) {
			success = `Transaction sent successfully! Hash: ${result.txHash}`;

			// Clear form
			recipient = '';
			amount = '';
			message = '';
			category = '';
	
			// Refresh balance
			setTimeout(() => getBalance(), 2000);
			authStore.refreshSession();
		} else {
			error = `Transaction error: ${result.error}`;
		}

		isLoading = false;
	}
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header
			class="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear"
		>
			<div class="flex items-center gap-2 px-4">
				<Sidebar.Trigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item>
							<Breadcrumb.Link href="/wallet">Wallet</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator />
						<Breadcrumb.Item>
							<Breadcrumb.Page>Send ZEI</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<SendForm
				bind:recipient={recipient}
				bind:amount={amount}
				bind:message={message}
				bind:category={category}
					{currentBalance}
				{isLoading}
				{error}
				{success}
				onSend={handleSend}
			/>

			<ConfirmDialog
				show={showConfirmDialog}
				{recipient}
				{amount}
				{message}
				{category}
				onConfirm={executeSend}
				onCancel={() => showConfirmDialog = false}
			/>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

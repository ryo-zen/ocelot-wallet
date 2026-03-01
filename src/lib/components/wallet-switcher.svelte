<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { useSidebar } from "$lib/components/ui/sidebar/index.js";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import OcelotLogo from './ocelot-logo.svelte';
	import { authStore } from '$lib/stores/auth.js';
	import { tauriWalletAPI } from '$lib/services/tauri-wallet-api.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const sidebar = useSidebar();

	let currentWallet = $state('');
	let availableWallets = $state<string[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		const authState = authStore.getCredentials();
		if (authState.isAuthenticated && authState.wallet) {
			currentWallet = authState.wallet;
		}

		const response = await tauriWalletAPI.listWallets();
		if (tauriWalletAPI.isSuccess(response)) {
			const data = tauriWalletAPI.unwrap(response);
			availableWallets = data.wallets;
		}
		isLoading = false;
	});

	async function switchWallet(walletName: string) {
		if (walletName === currentWallet) return;
		authStore.logout();
		goto(`/login?wallet=${encodeURIComponent(walletName)}`);
	}

	function createNewWallet() {
		goto('/wallet/create/name');
	}
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="flex w-full flex-col items-center rounded-md px-2 py-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2"
					>
						<OcelotLogo class="size-16 text-primary group-data-[collapsible=icon]:size-6" />
						<div class="mt-2 flex w-full items-center gap-2 group-data-[collapsible=icon]:hidden">
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-medium">
									{#if isLoading}
										Loading...
									{:else if currentWallet}
										{currentWallet}
									{:else}
										No Wallet
									{/if}
								</span>
								<span class="truncate text-xs text-muted-foreground">Current Wallet</span>
							</div>
							<ChevronsUpDownIcon class="size-4 shrink-0" />
						</div>
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				align="start"
				side={sidebar.isMobile ? "bottom" : "right"}
				sideOffset={4}
			>
				<DropdownMenu.Label class="text-muted-foreground text-xs">Wallets</DropdownMenu.Label>
				{#if isLoading}
					<DropdownMenu.Item disabled class="gap-2 p-2">
						Loading wallets...
					</DropdownMenu.Item>
				{:else if availableWallets.length === 0}
					<DropdownMenu.Item disabled class="gap-2 p-2">
						No wallets found
					</DropdownMenu.Item>
				{:else}
					{#each availableWallets as wallet, index (wallet)}
						<DropdownMenu.Item
							onSelect={() => switchWallet(wallet)}
							class="gap-2 p-2"
							disabled={wallet === currentWallet}
						>
							<div class="flex size-6 items-center justify-center rounded-md border">
								<WalletIcon class="size-3.5 shrink-0" />
							</div>
							{wallet}
							{#if wallet === currentWallet}
								<span class="ml-auto text-xs text-muted-foreground">Active</span>
							{:else}
								<DropdownMenu.Shortcut>⌘{index + 1}</DropdownMenu.Shortcut>
							{/if}
						</DropdownMenu.Item>
					{/each}
				{/if}
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="gap-2 p-2" onSelect={createNewWallet}>
					<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
						<PlusIcon class="size-4" />
					</div>
					<div class="text-muted-foreground font-medium">Create Wallet</div>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>

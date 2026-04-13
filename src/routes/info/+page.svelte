<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import InfoIcon from "@lucide/svelte/icons/info";

	async function openExternalUrl(url: string) {
		const { openUrl } = await import('@tauri-apps/plugin-opener');
		await openUrl(url);
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
							<Breadcrumb.Page>Info</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-3xl">
			<!-- Page Header -->
			<div class="bg-card border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-2">
					<InfoIcon class="h-6 w-6 text-primary" />
					<h1 class="text-2xl font-bold">About Ocelot Wallet</h1>
				</div>
				<p class="text-muted-foreground">
					What this project is, where it stands, and what to expect.
				</p>
			</div>

			<!-- What is ZeiCoin -->
			<div class="bg-card border rounded-xl p-6 space-y-3">
				<h2 class="text-lg font-semibold">What is ZeiCoin?</h2>
				<p class="text-muted-foreground leading-relaxed">
					ZeiCoin (ZEI) is a cryptocurrency under active development. Like Bitcoin, it is a
					peer-to-peer digital currency — transactions are recorded on a public ledger called a blockchain.
					A decentralised network keeps many copies of the blockchain so your funds are never lost.
				</p>
				<p class="text-muted-foreground leading-relaxed">
					ZeiCoin also supports short text messages attached to transactions.
					These are stored as off-chain metadata — held in a database alongside the transaction rather than on the blockchain itself.
					Keeping them off-chain means the blockchain stays efficient and is not burdened by message data.
					Your transactions are always stored on-chain and cannot be lost, but messages could be lost or corrupted if the off-chain database becomes unavailable.
					Messages on the testnet are in plain text and can be read by anyone. Messages are also subject to deletion on the testnet at anytime.
				</p>
			</div>

			<!-- Roadmap -->
			<div class="bg-card border rounded-xl p-6">
				<h2 class="text-lg font-semibold mb-3">Roadmap</h2>
				<p class="text-muted-foreground">
					The planned development milestones for ZeiCoin are published at
					<button onclick={() => openExternalUrl('https://zeicoin.com/roadmap.html')} class="font-semibold underline underline-offset-2 cursor-pointer">zeicoin.com/roadmap.html</button>
				</p>
			</div>

			<!-- What is Ocelot Wallet -->
			<div class="bg-card border rounded-xl p-6 space-y-3">
				<h2 class="text-lg font-semibold">What is Ocelot Wallet?</h2>
				<p class="text-muted-foreground leading-relaxed">
					Ocelot Wallet is a desktop application for managing ZeiCoin. It lets you create a
					wallet, receive ZEI at your address, send ZEI to others, and browse your transaction
					history. Your private keys are stored locally on your device and are never sent
					anywhere.
				</p>
				<p class="text-muted-foreground leading-relaxed">
					The wallet connects to the ZeiCoin network to fetch your balance and broadcast
					transactions. All network communication is encrypted.
				</p>
			</div>

			<!-- Current Status -->
			<div class="bg-card border rounded-xl p-6 space-y-3">
				<h2 class="text-lg font-semibold">Current Status</h2>
				<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
					<p class="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Testnet — funds are not real</p>
					<p class="text-sm text-yellow-700 dark:text-yellow-300">
						ZeiCoin is currently running on a test network. Coins on the testnet have no monetary
						value and cannot be sold, traded, or transferred to any exchange. They exist only
						for testing purposes.
					</p>
				</div>
				<p class="text-muted-foreground leading-relaxed">
					The project is in active development. Features may change, the network may be reset,
					and wallet files from earlier versions may not be compatible with future releases.
					Do not rely on testnet funds or wallet data being permanent.
				</p>
				<p class="text-muted-foreground leading-relaxed">
					You can request free testnet ZEI from the faucet on the dashboard — 0.2 ZEI per day.
					This is provided so you can explore the wallet without needing to receive funds from
					someone else.
				</p>
			</div>

			<!-- What to Expect -->
			<div class="bg-card border rounded-xl p-6 space-y-3">
				<h2 class="text-lg font-semibold">What to Expect</h2>
				<div class="space-y-4">
					<div>
						<p class="font-medium text-foreground mb-1">Changes</p>
						<p class="text-muted-foreground">The interface, features, and underlying protocol are subject to change without notice during this phase of development.</p>
					</div>
					<div>
						<p class="font-medium text-foreground mb-1">Network resets</p>
						<p class="text-muted-foreground">The testnet may be wiped and restarted, which would reset all balances to zero.</p>
					</div>
					<div>
						<p class="font-medium text-foreground mb-1">Bugs</p>
						<p class="text-muted-foreground">This is early software. You may encounter errors or unexpected behavior.</p>
					</div>
					<div>
						<p class="font-medium text-foreground mb-1">No support guarantees</p>
						<p class="text-muted-foreground">Support is best-effort during this stage. If something breaks, please submit an issue at <button onclick={() => openExternalUrl('https://github.com/ryo-zen/ocelot-wallet/issues')} class="font-semibold underline underline-offset-2 cursor-pointer">github.com/ryo-zen/ocelot-wallet/issues</button></p>
					</div>
				</div>
			</div>

		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

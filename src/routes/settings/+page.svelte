<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { authStore } from '$lib/stores/auth.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Settings2Icon from "@lucide/svelte/icons/settings-2";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import ServerIcon from "@lucide/svelte/icons/server";

	let isAuthenticated = false;

	// Subscribe to auth store
	authStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
	});

	onMount(() => {
		if (!isAuthenticated) {
			goto('/login-02');
			return;
		}
	});
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
							<Breadcrumb.Page>Settings</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<!-- Page Header -->
			<div class="bg-card border rounded-xl p-6">
				<div class="flex items-center gap-3 mb-2">
					<Settings2Icon class="h-6 w-6 text-primary" />
					<h1 class="text-2xl font-bold">Settings</h1>
				</div>
				<p class="text-muted-foreground">
					Configure your wallet preferences and appearance
				</p>
			</div>

			<!-- Settings Grid -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Theme Settings -->
				<div class="bg-card border rounded-xl p-6">
					<ThemeSwitcher />
				</div>

				<!-- Security Settings (Placeholder) -->
				<div class="bg-card border rounded-xl p-6">
					<div class="flex items-center gap-2 mb-4">
						<ShieldIcon class="h-5 w-5 text-muted-foreground" />
						<h3 class="text-lg font-semibold">Security</h3>
					</div>
					<div class="space-y-3">
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Session Timeout</p>
								<p class="text-sm text-muted-foreground">Currently set to 30 minutes</p>
							</div>
							<div class="text-sm text-muted-foreground">Active</div>
						</div>
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Auto Logout</p>
								<p class="text-sm text-muted-foreground">On tab close or visibility change</p>
							</div>
							<div class="text-sm text-muted-foreground">Enabled</div>
						</div>
					</div>
				</div>

				<!-- Service Config (Placeholder) -->
				<div class="bg-card border rounded-xl p-6">
					<div class="flex items-center gap-2 mb-4">
						<ServerIcon class="h-5 w-5 text-muted-foreground" />
						<h3 class="text-lg font-semibold">Service Configuration</h3>
					</div>
					<div class="space-y-3">
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">CLI Bridge</p>
								<p class="text-sm text-muted-foreground">http://127.0.0.1:8081/ws</p>
							</div>
							<div class="text-sm text-green-600">Connected</div>
						</div>
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">L2 API</p>
								<p class="text-sm text-muted-foreground">http://localhost:8080/api/l2</p>
							</div>
							<div class="text-sm text-green-600">Connected</div>
						</div>
					</div>
				</div>

				<!-- Additional Settings Placeholder -->
				<div class="bg-card border rounded-xl p-6">
					<h3 class="text-lg font-semibold mb-4">Advanced Options</h3>
					<div class="space-y-3">
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Debug Mode</p>
								<p class="text-sm text-muted-foreground">Show detailed console logs</p>
							</div>
							<div class="text-sm text-muted-foreground">Disabled</div>
						</div>
						<div class="flex items-center justify-between py-2">
							<div>
								<p class="font-medium">Transaction Cache</p>
								<p class="text-sm text-muted-foreground">Cache transaction data locally</p>
							</div>
							<div class="text-sm text-muted-foreground">Enabled</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
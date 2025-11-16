<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Card } from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { Badge } from "$lib/components/ui/badge";
	import SparklesIcon from "@lucide/svelte/icons/sparkles";
	import CheckIcon from "@lucide/svelte/icons/check";
	import ZapIcon from "@lucide/svelte/icons/zap";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
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
							<Breadcrumb.Page>Pro</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>

		<div class="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
			<!-- Header -->
			<div class="text-center space-y-4">
				<Badge variant="outline" class="mb-2">
					<SparklesIcon class="mr-1 h-3 w-3" />
					Premium Features
				</Badge>
				<h1 class="text-4xl font-bold tracking-tight">Upgrade to Zii Wallet Pro</h1>
				<p class="text-muted-foreground text-lg max-w-2xl mx-auto">
					Unlock advanced features and take your cryptocurrency management to the next level
				</p>
			</div>

			<!-- Pricing Card -->
			<Card class="p-8 max-w-md mx-auto w-full">
				<div class="text-center space-y-4">
					<h3 class="text-2xl font-semibold">Pro Plan</h3>
					<div class="flex items-baseline justify-center gap-2">
						<span class="text-5xl font-bold">$9.99</span>
						<span class="text-muted-foreground">/month</span>
					</div>
					<Button class="w-full" size="lg" disabled>
						<SparklesIcon class="mr-2 h-4 w-4" />
						Coming Soon
					</Button>
				</div>
			</Card>

			<!-- Features Grid -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
				<Card class="p-6">
					<div class="space-y-3">
						<div class="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
							<ZapIcon class="h-6 w-6 text-primary" />
						</div>
						<h4 class="font-semibold text-lg">Priority Transactions</h4>
						<p class="text-sm text-muted-foreground">
							Fast-track your transactions with priority processing on the network
						</p>
					</div>
				</Card>

				<Card class="p-6">
					<div class="space-y-3">
						<div class="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
							<ShieldIcon class="h-6 w-6 text-primary" />
						</div>
						<h4 class="font-semibold text-lg">Advanced Security</h4>
						<p class="text-sm text-muted-foreground">
							Multi-signature support and hardware wallet integration
						</p>
					</div>
				</Card>

				<Card class="p-6">
					<div class="space-y-3">
						<div class="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
							<TrendingUpIcon class="h-6 w-6 text-primary" />
						</div>
						<h4 class="font-semibold text-lg">Analytics Dashboard</h4>
						<p class="text-sm text-muted-foreground">
							Detailed insights and reports on your transaction history
						</p>
					</div>
				</Card>
			</div>

			<!-- Features List -->
			<Card class="p-6 mt-4">
				<h3 class="font-semibold text-lg mb-4">Everything included:</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div class="flex items-center gap-2">
						<CheckIcon class="h-5 w-5 text-primary" />
						<span class="text-sm">Unlimited transactions</span>
					</div>
					<div class="flex items-center gap-2">
						<CheckIcon class="h-5 w-5 text-primary" />
						<span class="text-sm">Priority support</span>
					</div>
					<div class="flex items-center gap-2">
						<CheckIcon class="h-5 w-5 text-primary" />
						<span class="text-sm">Advanced analytics</span>
					</div>
					<div class="flex items-center gap-2">
						<CheckIcon class="h-5 w-5 text-primary" />
						<span class="text-sm">Custom transaction fees</span>
					</div>
					<div class="flex items-center gap-2">
						<CheckIcon class="h-5 w-5 text-primary" />
						<span class="text-sm">API access</span>
					</div>
					<div class="flex items-center gap-2">
						<CheckIcon class="h-5 w-5 text-primary" />
						<span class="text-sm">Early access to new features</span>
					</div>
				</div>
			</Card>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

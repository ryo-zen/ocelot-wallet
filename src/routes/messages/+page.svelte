<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Card } from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import InboxIcon from "@lucide/svelte/icons/inbox";
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
							<Breadcrumb.Link href="/messages">Messages</Breadcrumb.Link>
						</Breadcrumb.Item>
						<Breadcrumb.Separator />
						<Breadcrumb.Item>
							<Breadcrumb.Page>All Messages</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>

		<div class="flex flex-col gap-6 p-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-semibold tracking-tight">Messages</h1>
					<p class="text-muted-foreground mt-1">
						Send and receive L2 messages with transactions
					</p>
				</div>
				<Button href="/messages/compose">
					<MessageSquareIcon class="mr-2 h-4 w-4" />
					Compose
				</Button>
			</div>

			<div class="grid gap-4">
				<!-- Empty State -->
				<Card class="p-12">
					<div class="flex flex-col items-center justify-center text-center space-y-4">
						<div class="rounded-full bg-muted p-6">
							<InboxIcon class="h-12 w-12 text-muted-foreground" />
						</div>
						<div class="space-y-2">
							<h3 class="text-xl font-semibold">No messages yet</h3>
							<p class="text-muted-foreground max-w-md">
								Messages will appear here once you send or receive L2 messages attached to transactions. Get started by composing your first message.
							</p>
						</div>
						<Button href="/messages/compose" variant="outline" class="mt-4">
							<MessageSquareIcon class="mr-2 h-4 w-4" />
							Compose Message
						</Button>
					</div>
				</Card>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

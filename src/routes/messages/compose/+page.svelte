<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Card } from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Textarea } from "$lib/components/ui/textarea";
	import SendIcon from "@lucide/svelte/icons/send";

	let recipient = $state("");
	let subject = $state("");
	let message = $state("");
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
							<Breadcrumb.Page>Compose</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>

		<div class="flex flex-col gap-6 p-6">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">Compose Message</h1>
				<p class="text-muted-foreground mt-1">
					Send an L2 message attached to a transaction
				</p>
			</div>

	<!-- Compose Form -->
	<Card class="p-6">
		<form class="space-y-6">
			<div class="space-y-2">
				<Label for="recipient">Recipient Address</Label>
				<Input
					id="recipient"
					type="text"
					placeholder="tzei1..."
					bind:value={recipient}
				/>
				<p class="text-sm text-muted-foreground">
					Enter the ZeiCoin address of the recipient
				</p>
			</div>

			<div class="space-y-2">
				<Label for="subject">Subject</Label>
				<Input
					id="subject"
					type="text"
					placeholder="Enter message subject"
					bind:value={subject}
				/>
			</div>

			<div class="space-y-2">
				<Label for="message">Message</Label>
				<Textarea
					id="message"
					placeholder="Enter your message..."
					rows={8}
					bind:value={message}
				/>
				<p class="text-sm text-muted-foreground">
					Maximum 1000 characters
				</p>
			</div>

			<div class="flex items-center justify-between pt-4 border-t">
				<div class="text-sm text-muted-foreground">
					Estimated fee: 0.00005 ZEI
				</div>
				<div class="flex gap-3">
					<Button href="/messages" variant="outline">
						Cancel
					</Button>
					<Button type="submit" disabled>
						<SendIcon class="mr-2 h-4 w-4" />
						Send Message
					</Button>
				</div>
			</div>
		</form>
	</Card>

	</div>
	</Sidebar.Inset>
</Sidebar.Provider>

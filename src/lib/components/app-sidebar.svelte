<script lang="ts" module>
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import Settings2Icon from "@lucide/svelte/icons/settings-2";
	import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";

	const navMain = [
			{
				title: "Wallet",
				url: "/wallet",
				icon: SquareTerminalIcon,
				isActive: true,
				items: [
					{
						title: "Dashboard",
						url: "/wallet/dashboard",
					},
					{
						title: "Send",
						url: "/wallet/send",
					},
					{
						title: "Transactions",
						url: "/wallet/transactions",
					},
				],
			},
			{
				title: "Messages",
				url: "/messages",
				icon: MessageSquareIcon,
				items: [
					{
						title: "All Messages",
						url: "/messages",
					},
					{
						title: "Compose",
						url: "/messages/compose",
					},
				],
			},
			{
				title: "Settings",
				url: "/settings",
				icon: Settings2Icon,
				items: [
					{
						title: "General",
						url: "/settings",
					},
				],
			},
		];
</script>

<script lang="ts">
	import NavMain from "./nav-main.svelte";
	import NavQuickActions from "./nav-quick-actions.svelte";
	import NavUser from "./nav-user.svelte";
	import WalletSwitcher from "./wallet-switcher.svelte";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		...restProps
	}: ComponentProps<typeof Sidebar.Root> = $props();

	const userData = {
		name: 'Zii Wallet',
		email: '',
		avatar: ''
	};
</script>

<Sidebar.Root {collapsible} {...restProps}>
	<Sidebar.Header>
		<WalletSwitcher />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navMain} />
		<NavQuickActions />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser user={userData} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>

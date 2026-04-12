<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { useSidebar } from "$lib/components/ui/sidebar/context.svelte.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import SendIcon from "@lucide/svelte/icons/send";
	import BookUserIcon from "@lucide/svelte/icons/book-user";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
	import EditIcon from "@lucide/svelte/icons/edit";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import { addressBookStore, type AddressBookState } from '$lib/stores/address-book.js';
	import { goto } from '$app/navigation';

	const sidebar = useSidebar();

	// Subscribe to address book for frequent contacts
	let addressBook = $state<AddressBookState>({ entries: [] });
	addressBookStore.subscribe(state => {
		addressBook = state;
	});

	// Get top 3 frequent contacts
	let frequentContacts = $derived(
		addressBook.entries
			.filter(entry => entry.lastUsed)
			.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
			.slice(0, 3)
	);

	function sendToAddress(address: string, entryId: string) {
		// Mark as used
		addressBookStore.markAsUsed(entryId);
		// Navigate to send page with pre-filled address
		goto(`/wallet/send?to=${encodeURIComponent(address)}`);
	}

	function manageAddressBook() {
		goto('/wallet/address-book');
	}
</script>

<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
	<Sidebar.GroupLabel>Quick Actions</Sidebar.GroupLabel>
	<Sidebar.Menu>
		<!-- Address Book -->
		<Sidebar.MenuItem>
			<Sidebar.MenuButton>
				{#snippet child({ props })}
					<a href="/wallet/address-book" {...props}>
						<BookUserIcon />
						<span>Address Book</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>

		<!-- Frequent Contacts Section -->
		{#if frequentContacts.length > 0}
			<Sidebar.GroupLabel class="mt-4 text-xs text-muted-foreground">Frequent Contacts</Sidebar.GroupLabel>
			{#each frequentContacts as contact (contact.id)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton onclick={() => sendToAddress(contact.address, contact.id)}>
						<BookUserIcon class="size-4" />
						<span class="truncate">{contact.name}</span>
					</Sidebar.MenuButton>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Sidebar.MenuAction showOnHover {...props}>
									<EllipsisIcon />
									<span class="sr-only">More</span>
								</Sidebar.MenuAction>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="w-48 rounded-lg"
							side={sidebar.isMobile ? "bottom" : "right"}
							align={sidebar.isMobile ? "end" : "start"}
						>
							<DropdownMenu.Item onclick={() => sendToAddress(contact.address, contact.id)}>
								<SendIcon class="text-muted-foreground" />
								<span>Send to {contact.name}</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={manageAddressBook}>
								<EditIcon class="text-muted-foreground" />
								<span>Edit Contact</span>
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={() => addressBookStore.deleteEntry(contact.id)}>
								<Trash2Icon class="text-muted-foreground" />
								<span>Remove</span>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Sidebar.MenuItem>
			{/each}
		{/if}

		<!-- Add Contact -->
		<Sidebar.MenuItem>
			<Sidebar.MenuButton class="text-sidebar-foreground/70" onclick={manageAddressBook}>
				<PlusIcon class="text-sidebar-foreground/70" />
				<span>Manage Contacts</span>
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
</Sidebar.Group>

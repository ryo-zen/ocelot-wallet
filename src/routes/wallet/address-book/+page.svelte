<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import BookUserIcon from "@lucide/svelte/icons/book-user";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import EditIcon from "@lucide/svelte/icons/edit";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import SendIcon from "@lucide/svelte/icons/send";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { addressBookStore, type AddressBookEntry } from '$lib/stores/address-book.js';
	import { goto } from '$app/navigation';

	let addressBook = $state({ entries: [] });
	addressBookStore.subscribe(state => {
		addressBook = state;
	});

	let isAddDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let searchQuery = $state('');

	let currentEntry: AddressBookEntry | null = $state(null);

	// Form fields
	let formName = $state('');
	let formAddress = $state('');
	let formCategory = $state('');
	let formNotes = $state('');

	// Filter entries based on search
	let filteredEntries = $derived(
		searchQuery
			? addressBook.entries.filter(entry =>
				entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				entry.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
				entry.category?.toLowerCase().includes(searchQuery.toLowerCase())
			)
			: addressBook.entries
	);

	function openAddDialog() {
		formName = '';
		formAddress = '';
		formCategory = '';
		formNotes = '';
		isAddDialogOpen = true;
	}

	function openEditDialog(entry: AddressBookEntry) {
		currentEntry = entry;
		formName = entry.name;
		formAddress = entry.address;
		formCategory = entry.category || '';
		formNotes = entry.notes || '';
		isEditDialogOpen = true;
	}

	function handleAdd() {
		if (!formName.trim() || !formAddress.trim()) {
			alert('Name and address are required');
			return;
		}

		addressBookStore.addEntry({
			name: formName.trim(),
			address: formAddress.trim(),
			category: formCategory.trim() || undefined,
			notes: formNotes.trim() || undefined,
		});

		isAddDialogOpen = false;
	}

	function handleEdit() {
		if (!currentEntry || !formName.trim() || !formAddress.trim()) {
			alert('Name and address are required');
			return;
		}

		addressBookStore.updateEntry(currentEntry.id, {
			name: formName.trim(),
			address: formAddress.trim(),
			category: formCategory.trim() || undefined,
			notes: formNotes.trim() || undefined,
		});

		isEditDialogOpen = false;
		currentEntry = null;
	}

	function handleDelete(id: string) {
		if (confirm('Are you sure you want to delete this contact?')) {
			addressBookStore.deleteEntry(id);
		}
	}

	function sendToContact(address: string, id: string) {
		addressBookStore.markAsUsed(id);
		goto(`/wallet/send?to=${encodeURIComponent(address)}`);
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
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
							<Breadcrumb.Page>Address Book</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>

		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			<!-- Header with Add Button -->
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-2xl font-bold">Address Book</h2>
					<p class="text-muted-foreground">Manage your saved contacts and addresses</p>
				</div>
				<Button onclick={openAddDialog}>
					<PlusIcon class="mr-2 size-4" />
					Add Contact
				</Button>
			</div>

			<!-- Search Bar -->
			<div class="relative">
				<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Search contacts by name, address, or category..."
					class="pl-10"
					bind:value={searchQuery}
				/>
			</div>

			<!-- Contacts List -->
			{#if filteredEntries.length === 0}
				<div class="bg-card border rounded-xl p-12 text-center">
					<BookUserIcon class="mx-auto size-12 text-muted-foreground mb-4" />
					<h3 class="text-lg font-semibold mb-2">
						{searchQuery ? 'No contacts found' : 'No contacts yet'}
					</h3>
					<p class="text-muted-foreground mb-4">
						{searchQuery
							? 'Try a different search term'
							: 'Add your first contact to get started'}
					</p>
					{#if !searchQuery}
						<Button onclick={openAddDialog}>
							<PlusIcon class="mr-2 size-4" />
							Add Contact
						</Button>
					{/if}
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredEntries as entry (entry.id)}
						<Card.Root>
							<Card.Header>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<Card.Title class="flex items-center gap-2">
											<BookUserIcon class="size-4" />
											{entry.name}
										</Card.Title>
										{#if entry.category}
											<Badge variant="outline" class="mt-1">{entry.category}</Badge>
										{/if}
									</div>
								</div>
							</Card.Header>
							<Card.Content class="space-y-3">
								<div>
									<Label class="text-xs text-muted-foreground">Address</Label>
									<p class="font-mono text-xs break-all">{entry.address}</p>
								</div>
								{#if entry.notes}
									<div>
										<Label class="text-xs text-muted-foreground">Notes</Label>
										<p class="text-sm">{entry.notes}</p>
									</div>
								{/if}
								<div>
									<Label class="text-xs text-muted-foreground">Added</Label>
									<p class="text-sm">{formatDate(entry.createdAt)}</p>
								</div>
								{#if entry.lastUsed}
									<div>
										<Label class="text-xs text-muted-foreground">Last Used</Label>
										<p class="text-sm">{formatDate(entry.lastUsed)}</p>
									</div>
								{/if}
							</Card.Content>
							<Card.Footer class="flex gap-2">
								<Button
									size="sm"
									class="flex-1"
									onclick={() => sendToContact(entry.address, entry.id)}
								>
									<SendIcon class="mr-2 size-3" />
									Send
								</Button>
								<Button
									size="sm"
									variant="outline"
									onclick={() => openEditDialog(entry)}
								>
									<EditIcon class="size-3" />
								</Button>
								<Button
									size="sm"
									variant="outline"
									onclick={() => handleDelete(entry.id)}
								>
									<Trash2Icon class="size-3" />
								</Button>
							</Card.Footer>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<!-- Add Contact Dialog -->
<Dialog.Root bind:open={isAddDialogOpen}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add New Contact</Dialog.Title>
			<Dialog.Description>
				Add a new contact to your address book for quick access.
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="add-name">Name</Label>
				<Input id="add-name" placeholder="Contact name" bind:value={formName} />
			</div>
			<div class="grid gap-2">
				<Label for="add-address">ZeiCoin Address</Label>
				<Input
					id="add-address"
					placeholder="tzei1..."
					class="font-mono"
					bind:value={formAddress}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="add-category">Category (optional)</Label>
				<Input id="add-category" placeholder="e.g., Friends, Business" bind:value={formCategory} />
			</div>
			<div class="grid gap-2">
				<Label for="add-notes">Notes (optional)</Label>
				<Textarea
					id="add-notes"
					placeholder="Additional notes about this contact"
					bind:value={formNotes}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (isAddDialogOpen = false)}>Cancel</Button>
			<Button onclick={handleAdd}>Add Contact</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Contact Dialog -->
<Dialog.Root bind:open={isEditDialogOpen}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Edit Contact</Dialog.Title>
			<Dialog.Description>
				Update the contact information.
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="edit-name">Name</Label>
				<Input id="edit-name" placeholder="Contact name" bind:value={formName} />
			</div>
			<div class="grid gap-2">
				<Label for="edit-address">ZeiCoin Address</Label>
				<Input
					id="edit-address"
					placeholder="tzei1..."
					class="font-mono"
					bind:value={formAddress}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="edit-category">Category (optional)</Label>
				<Input id="edit-category" placeholder="e.g., Friends, Business" bind:value={formCategory} />
			</div>
			<div class="grid gap-2">
				<Label for="edit-notes">Notes (optional)</Label>
				<Textarea
					id="edit-notes"
					placeholder="Additional notes about this contact"
					bind:value={formNotes}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => {
				isEditDialogOpen = false;
				currentEntry = null;
			}}>Cancel</Button>
			<Button onclick={handleEdit}>Save Changes</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

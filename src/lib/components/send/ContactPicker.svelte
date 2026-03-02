<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import BookUserIcon from "@lucide/svelte/icons/book-user";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { addressBookStore, type AddressBookEntry } from '$lib/stores/address-book.js';

	interface Props {
		open: boolean;
		onSelect: (address: string, contactId: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), onSelect, onClose }: Props = $props();

	let addressBook = $state<{ entries: AddressBookEntry[] }>({ entries: [] });
	addressBookStore.subscribe(state => {
		addressBook = state;
	});

	let searchQuery = $state('');

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

	function handleSelect(entry: AddressBookEntry) {
		onSelect(entry.address, entry.id);
		searchQuery = ''; // Reset search
		open = false;
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[600px] max-h-[80vh] flex flex-col">
		<Dialog.Header>
			<Dialog.Title>Select Contact</Dialog.Title>
			<Dialog.Description>
				Choose a contact from your address book to autofill the recipient address.
			</Dialog.Description>
		</Dialog.Header>

		<!-- Search Bar -->
		<div class="relative">
			<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search contacts..."
				class="pl-10"
				bind:value={searchQuery}
			/>
		</div>

		<!-- Contact List -->
		<div class="overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
			{#if filteredEntries.length === 0}
				<div class="py-12 text-center">
					<BookUserIcon class="mx-auto size-12 text-muted-foreground mb-4" />
					<h3 class="text-lg font-semibold mb-2">
						{searchQuery ? 'No contacts found' : 'No contacts yet'}
					</h3>
					<p class="text-muted-foreground">
						{searchQuery
							? 'Try a different search term'
							: 'Add contacts in the Address Book page'}
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each filteredEntries as entry (entry.id)}
						<button
							onclick={() => handleSelect(entry)}
							class="w-full text-left p-4 rounded-lg border hover:bg-accent hover:border-accent-foreground transition-colors"
						>
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<BookUserIcon class="size-4 text-muted-foreground flex-shrink-0" />
										<h4 class="font-semibold">{entry.name}</h4>
										{#if entry.category}
											<Badge variant="outline" class="text-xs">{entry.category}</Badge>
										{/if}
									</div>
									<p class="font-mono text-xs text-muted-foreground break-all">
										{entry.address}
									</p>
									{#if entry.notes}
										<p class="text-sm text-muted-foreground mt-1 line-clamp-1">
											{entry.notes}
										</p>
									{/if}
									{#if entry.lastUsed}
										<p class="text-xs text-muted-foreground mt-1">
											Last used: {formatDate(entry.lastUsed)}
										</p>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>Cancel</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

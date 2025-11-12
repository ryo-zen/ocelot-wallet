import { writable } from 'svelte/store';

export interface AddressBookEntry {
	id: string;
	name: string;
	address: string;
	category?: string;
	notes?: string;
	createdAt: number;
	lastUsed?: number;
}

interface AddressBookState {
	entries: AddressBookEntry[];
}

const STORAGE_KEY = 'zii_address_book';

function createAddressBookStore() {
	// Load from localStorage
	const loadFromStorage = (): AddressBookState => {
		if (typeof window === 'undefined') {
			return { entries: [] };
		}

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				return JSON.parse(stored);
			}
		} catch (error) {
			console.error('Failed to load address book:', error);
		}
		return { entries: [] };
	};

	const { subscribe, set, update } = writable<AddressBookState>(loadFromStorage());

	// Save to localStorage whenever state changes
	const saveToStorage = (state: AddressBookState) => {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			} catch (error) {
				console.error('Failed to save address book:', error);
			}
		}
	};

	return {
		subscribe,

		// Add a new entry
		addEntry: (entry: Omit<AddressBookEntry, 'id' | 'createdAt'>) => {
			update(state => {
				const newEntry: AddressBookEntry = {
					...entry,
					id: crypto.randomUUID(),
					createdAt: Date.now(),
				};
				const newState = {
					entries: [...state.entries, newEntry]
				};
				saveToStorage(newState);
				return newState;
			});
		},

		// Update an existing entry
		updateEntry: (id: string, updates: Partial<Omit<AddressBookEntry, 'id' | 'createdAt'>>) => {
			update(state => {
				const newState = {
					entries: state.entries.map(entry =>
						entry.id === id ? { ...entry, ...updates } : entry
					)
				};
				saveToStorage(newState);
				return newState;
			});
		},

		// Delete an entry
		deleteEntry: (id: string) => {
			update(state => {
				const newState = {
					entries: state.entries.filter(entry => entry.id !== id)
				};
				saveToStorage(newState);
				return newState;
			});
		},

		// Mark an entry as recently used
		markAsUsed: (id: string) => {
			update(state => {
				const newState = {
					entries: state.entries.map(entry =>
						entry.id === id ? { ...entry, lastUsed: Date.now() } : entry
					)
				};
				saveToStorage(newState);
				return newState;
			});
		},

		// Get frequently used entries (sorted by lastUsed)
		getFrequentEntries: (limit = 5): AddressBookEntry[] => {
			let entries: AddressBookEntry[] = [];
			subscribe(state => {
				entries = state.entries;
			})();

			return entries
				.filter(entry => entry.lastUsed)
				.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
				.slice(0, limit);
		},

		// Search entries by name or address
		searchEntries: (query: string): AddressBookEntry[] => {
			let entries: AddressBookEntry[] = [];
			subscribe(state => {
				entries = state.entries;
			})();

			const lowerQuery = query.toLowerCase();
			return entries.filter(entry =>
				entry.name.toLowerCase().includes(lowerQuery) ||
				entry.address.toLowerCase().includes(lowerQuery) ||
				entry.category?.toLowerCase().includes(lowerQuery)
			);
		},

		// Clear all entries
		clear: () => {
			const newState = { entries: [] };
			set(newState);
			saveToStorage(newState);
		}
	};
}

export const addressBookStore = createAddressBookStore();

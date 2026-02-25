import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

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

const LEGACY_STORAGE_KEY = 'ocelot_address_book';

let initialized = false;

async function loadFromTauri(): Promise<AddressBookState> {
	try {
		const response = await invoke<{ success: boolean; data?: string }>('get_contacts');
		if (response.success && response.data) {
			const entries = JSON.parse(response.data);
			if (Array.isArray(entries) && entries.length > 0) {
				return { entries };
			}
		}
	} catch (e) {
		console.error('Failed to load contacts from Tauri:', e);
	}
	return { entries: [] };
}

function persistToTauri(state: AddressBookState) {
	invoke('save_contacts', { contactsJson: JSON.stringify(state.entries) })
		.catch(err => console.error('Failed to save contacts:', err));
}

function createAddressBookStore() {
	const { subscribe, set, update } = writable<AddressBookState>({ entries: [] });

	return {
		subscribe,

		init: async () => {
			if (initialized) return;
			initialized = true;

			let state = await loadFromTauri();

			// Migration: if Tauri is empty, check localStorage for existing data
			if (state.entries.length === 0 && typeof window !== 'undefined') {
				const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
				if (stored) {
					try {
						const parsed = JSON.parse(stored);
						if (parsed.entries?.length > 0) {
							state = parsed;
							persistToTauri(state);
							localStorage.removeItem(LEGACY_STORAGE_KEY);
						}
					} catch { /* ignore corrupt data */ }
				}
			}

			set(state);
		},

		addEntry: (entry: Omit<AddressBookEntry, 'id' | 'createdAt'>) => {
			update(state => {
				const newEntry: AddressBookEntry = {
					...entry,
					id: crypto.randomUUID(),
					createdAt: Date.now(),
				};
				const newState = { entries: [...state.entries, newEntry] };
				persistToTauri(newState);
				return newState;
			});
		},

		updateEntry: (id: string, updates: Partial<Omit<AddressBookEntry, 'id' | 'createdAt'>>) => {
			update(state => {
				const newState = {
					entries: state.entries.map(entry =>
						entry.id === id ? { ...entry, ...updates } : entry
					)
				};
				persistToTauri(newState);
				return newState;
			});
		},

		deleteEntry: (id: string) => {
			update(state => {
				const newState = {
					entries: state.entries.filter(entry => entry.id !== id)
				};
				persistToTauri(newState);
				return newState;
			});
		},

		markAsUsed: (id: string) => {
			update(state => {
				const newState = {
					entries: state.entries.map(entry =>
						entry.id === id ? { ...entry, lastUsed: Date.now() } : entry
					)
				};
				persistToTauri(newState);
				return newState;
			});
		},

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

		clear: () => {
			const newState = { entries: [] };
			set(newState);
			persistToTauri(newState);
		}
	};
}

export const addressBookStore = createAddressBookStore();

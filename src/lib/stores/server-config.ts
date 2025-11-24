/**
 * Server Configuration Store
 *
 * Manages user's selected ZeiCoin server with localStorage persistence
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface ServerOption {
	id: string;
	name: string;
	url: string; // Transaction API URL (port 8080)
	rpcUrl: string; // JSON-RPC URL (port 10803)
	description: string;
	type: 'production' | 'testnet' | 'local';
}

export const availableServers: ServerOption[] = [
	{
		id: 'sydney-production',
		name: 'Sydney Production Server (HTTPS)',
		url: 'https://209.38.31.77:443',
		rpcUrl: 'https://209.38.31.77:10804',
		description: 'Main production server with TLS 1.3 encryption',
		type: 'production'
	},
	{
		id: 'local-testnet',
		name: 'Local Testnet',
		url: 'http://127.0.0.1:10802',
		rpcUrl: 'http://127.0.0.1:10803',
		description: 'Local development testnet server',
		type: 'local'
	},
	{
		id: 'local-mainnet',
		name: 'Local Mainnet',
		url: 'http://127.0.0.1:3000',
		rpcUrl: 'http://127.0.0.1:10803',
		description: 'Local mainnet node',
		type: 'local'
	}
];

interface ServerConfigState {
	selectedServerId: string;
	customServerUrl: string | null;
}

const STORAGE_KEY = 'zeicoin_server_config';

// Default to Sydney production server
const defaultState: ServerConfigState = {
	selectedServerId: 'sydney-production',
	customServerUrl: null
};

function createServerConfigStore() {
	// Load from localStorage if available
	const initialState = browser
		? (() => {
				try {
					const stored = localStorage.getItem(STORAGE_KEY);
					if (stored) {
						return JSON.parse(stored) as ServerConfigState;
					}
				} catch (e) {
					console.error('Failed to load server config from localStorage:', e);
				}
				return defaultState;
		  })()
		: defaultState;

	const { subscribe, set, update } = writable<ServerConfigState>(initialState);

	return {
		subscribe,

		/**
		 * Select a predefined server
		 */
		selectServer: (serverId: string) => {
			update(state => {
				const newState = {
					...state,
					selectedServerId: serverId,
					customServerUrl: null // Clear custom URL when selecting predefined server
				};

				// Save to localStorage
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
					} catch (e) {
						console.error('Failed to save server config to localStorage:', e);
					}
				}

				return newState;
			});
		},

		/**
		 * Set custom server URL
		 */
		setCustomServer: (url: string) => {
			update(state => {
				const newState = {
					...state,
					selectedServerId: 'custom',
					customServerUrl: url
				};

				// Save to localStorage
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
					} catch (e) {
						console.error('Failed to save server config to localStorage:', e);
					}
				}

				return newState;
			});
		},

		/**
		 * Get current server URL
		 */
		getCurrentServerUrl: (): string => {
			let currentUrl = defaultState.selectedServerId;

			if (browser) {
				try {
					const stored = localStorage.getItem(STORAGE_KEY);
					if (stored) {
						const state = JSON.parse(stored) as ServerConfigState;

						if (state.selectedServerId === 'custom' && state.customServerUrl) {
							return state.customServerUrl;
						}

						const server = availableServers.find(s => s.id === state.selectedServerId);
						if (server) {
							return server.url;
						}
					}
				} catch (e) {
					console.error('Failed to get current server URL:', e);
				}
			}

			// Fallback to default (Dallas production)
			return availableServers[0].url;
		},

		/**
		 * Get current RPC URL
		 */
		getCurrentRpcUrl: (): string => {
			if (browser) {
				try {
					const stored = localStorage.getItem(STORAGE_KEY);
					if (stored) {
						const state = JSON.parse(stored) as ServerConfigState;

						const server = availableServers.find(s => s.id === state.selectedServerId);
						if (server) {
							return server.rpcUrl;
						}
					}
				} catch (e) {
					console.error('Failed to get current RPC URL:', e);
				}
			}

			// Fallback to default (Dallas production)
			return availableServers[0].rpcUrl;
		},

		/**
		 * Reset to default server
		 */
		reset: () => {
			set(defaultState);
			if (browser) {
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (e) {
					console.error('Failed to reset server config:', e);
				}
			}
		}
	};
}

export const serverConfigStore = createServerConfigStore();

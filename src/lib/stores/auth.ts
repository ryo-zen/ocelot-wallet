import { writable, get } from 'svelte/store';
import { tauriWalletAPI } from '$lib/services/tauri-wallet-api';

interface AuthState {
	wallet: string | null;
	address: string | null;
	encryptedPassword: string | null;
	isAuthenticated: boolean;
	sessionExpiry: number | null;
}

interface LoginResult {
	success: boolean;
	error?: string;
}

interface Credentials {
	wallet: string | null;
	password: string | null;
	isAuthenticated: boolean;
	sessionExpired?: boolean;
}

// Session timeout (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Simple base64 encoding for password (basic obfuscation, not real encryption)
function encryptPassword(password: string): string {
	return btoa(password);
}

function decryptPassword(encryptedPassword: string): string {
	try {
		return atob(encryptedPassword);
	} catch {
		return '';
	}
}

// Load persisted session from storage
function loadPersistedSession(): AuthState {
	if (typeof window === 'undefined') {
		return {
			wallet: null,
			address: null,
			encryptedPassword: null,
			isAuthenticated: false,
			sessionExpiry: null
		};
	}

	try {
		const stored = sessionStorage.getItem('wallet_session');
		if (stored) {
			const parsed = JSON.parse(stored);
			// Check if session is still valid
			if (parsed.sessionExpiry && Date.now() < parsed.sessionExpiry) {
				return parsed;
			} else {
				sessionStorage.removeItem('wallet_session');
			}
		}
	} catch (e) {
		sessionStorage.removeItem('wallet_session');
	}

	return {
		wallet: null,
		address: null,
		encryptedPassword: null,
		isAuthenticated: false,
		sessionExpiry: null
	};
}

function createAuthStore() {
	const initialState = loadPersistedSession();
	const store = writable<AuthState>(initialState);
	const { subscribe, set, update } = store;
	let sessionTimer: number | null = null;

	// Persist state to sessionStorage
	function persistSession(state: AuthState) {
		if (typeof window !== 'undefined') {
			try {
				if (state.isAuthenticated) {
					sessionStorage.setItem('wallet_session', JSON.stringify(state));
				} else {
					sessionStorage.removeItem('wallet_session');
				}
			} catch (e) {
				console.error('Failed to persist session:', e);
			}
		}
	}

	// Start auto-logout timer
	function startSessionTimer() {
		if (sessionTimer) {
			clearTimeout(sessionTimer);
		}
		sessionTimer = setTimeout(() => {
			logout();
		}, SESSION_TIMEOUT_MS) as unknown as number;
	}

	// Logout function
	function logout() {
		if (sessionTimer) {
			clearTimeout(sessionTimer);
			sessionTimer = null;
		}

		const clearedState: AuthState = {
			wallet: null,
			address: null,
			encryptedPassword: null,
			isAuthenticated: false,
			sessionExpiry: null
		};

		set(clearedState);
		persistSession(clearedState);
	}

	// Check if session is expired
	function isSessionExpired(): boolean {
		const currentState = get(store);

		if (!currentState.isAuthenticated || !currentState.sessionExpiry) {
			return true;
		}

		return Date.now() > currentState.sessionExpiry;
	}

	return {
		subscribe,

		/**
		 * Login with wallet name and password
		 * Uses Tauri command to validate credentials
		 */
		login: async (wallet: string, password: string): Promise<LoginResult> => {
			try {
				// Validate credentials via Tauri
				const response = await tauriWalletAPI.unlockWallet(wallet, password);

				if (tauriWalletAPI.isSuccess(response)) {
					const data = tauriWalletAPI.unwrap(response);

					const sessionExpiry = Date.now() + SESSION_TIMEOUT_MS;
					const newState: AuthState = {
						wallet: data.name,
						address: data.address,
						encryptedPassword: encryptPassword(password),
						isAuthenticated: true,
						sessionExpiry
					};

					set(newState);
					persistSession(newState);
					startSessionTimer();

					return { success: true };
				} else {
					return {
						success: false,
						error: response.error || 'Login failed'
					};
				}
			} catch (err) {
				const error = err instanceof Error ? err.message : String(err);
				return {
					success: false,
					error
				};
			}
		},

		/**
		 * Logout and clear session
		 */
		logout,

		/**
		 * Get current credentials
		 * Returns null if session expired or not authenticated
		 */
		getCredentials: (): Credentials => {
			const currentState = get(store);

			if (isSessionExpired()) {
				return {
					wallet: currentState.wallet,
					password: null,
					isAuthenticated: false,
					sessionExpired: true
				};
			}

			return {
				wallet: currentState.wallet,
				password: currentState.encryptedPassword
					? decryptPassword(currentState.encryptedPassword)
					: null,
				isAuthenticated: currentState.isAuthenticated,
				sessionExpired: false
			};
		},

		/**
		 * Refresh session expiry time
		 * Extends the session timeout
		 */
		refreshSession: (): boolean => {
			const currentState = get(store);

			if (currentState.isAuthenticated && currentState.wallet && currentState.encryptedPassword) {
				const refreshedState: AuthState = {
					...currentState,
					sessionExpiry: Date.now() + SESSION_TIMEOUT_MS
				};

				update(() => refreshedState);
				persistSession(refreshedState);
				startSessionTimer();
				return true;
			}

			return false;
		}
	};
}

export const authStore = createAuthStore();

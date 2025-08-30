import { writable } from 'svelte/store';

interface AuthState {
	wallet: string | null;
	encryptedPassword: string | null;
	isAuthenticated: boolean;
	sessionExpiry: number | null;
}

const initialState: AuthState = {
	wallet: null,
	encryptedPassword: null,
	isAuthenticated: false,
	sessionExpiry: null
};

// Simple XOR encryption for password obfuscation in memory
function encryptPassword(password: string): string {
	const key = 'ZEI_WALLET_' + Date.now().toString(36);
	let encrypted = '';
	for (let i = 0; i < password.length; i++) {
		encrypted += String.fromCharCode(password.charCodeAt(i) ^ key.charCodeAt(i % key.length));
	}
	return btoa(encrypted + '::' + key);
}

function decryptPassword(encryptedPassword: string): string {
	try {
		const decoded = atob(encryptedPassword);
		const [encrypted, key] = decoded.split('::');
		let decrypted = '';
		for (let i = 0; i < encrypted.length; i++) {
			decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
		}
		return decrypted;
	} catch {
		return '';
	}
}

// Session timeout (15 minutes)
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);
	let sessionTimer: NodeJS.Timeout | null = null;

	// Auto-logout on session timeout
	function startSessionTimer() {
		if (sessionTimer) clearTimeout(sessionTimer);
		sessionTimer = setTimeout(() => {
			logout();
		}, SESSION_TIMEOUT_MS);
	}

	function logout() {
		// Clear session timer
		if (sessionTimer) {
			clearTimeout(sessionTimer);
			sessionTimer = null;
		}

		// Overwrite sensitive data in memory
		update(state => {
			if (state.encryptedPassword) {
				// Overwrite encrypted password with random data
				state.encryptedPassword = btoa(Math.random().toString(36) + Math.random().toString(36));
			}
			return initialState;
		});

		// Force garbage collection hint
		if (window.gc) window.gc();
	}

	// Check session validity
	function isSessionValid(): boolean {
		let currentState: AuthState;
		subscribe(state => currentState = state)();
		
		if (!currentState.isAuthenticated || !currentState.sessionExpiry) {
			return false;
		}

		if (Date.now() > currentState.sessionExpiry) {
			logout();
			return false;
		}

		return true;
	}

	return {
		subscribe,
		login: (wallet: string, password: string) => {
			const sessionExpiry = Date.now() + SESSION_TIMEOUT_MS;
			set({
				wallet,
				encryptedPassword: encryptPassword(password),
				isAuthenticated: true,
				sessionExpiry
			});
			
			// Clear password from parameter immediately
			password = '';
			
			startSessionTimer();
		},
		logout,
		getCredentials: () => {
			if (!isSessionValid()) {
				return { wallet: null, password: null, isAuthenticated: false };
			}

			let currentState: AuthState;
			subscribe(state => currentState = state)();
			
			return {
				wallet: currentState.wallet,
				password: currentState.encryptedPassword ? decryptPassword(currentState.encryptedPassword) : null,
				isAuthenticated: currentState.isAuthenticated
			};
		},
		refreshSession: () => {
			if (isSessionValid()) {
				update(state => ({
					...state,
					sessionExpiry: Date.now() + SESSION_TIMEOUT_MS
				}));
				startSessionTimer();
			}
		}
	};
}

export const authStore = createAuthStore();

// Auto-logout on page unload/close
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		authStore.logout();
	});

	// Auto-logout on browser tab visibility change (security measure)
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			// Don't logout immediately, but start a shorter timer
			setTimeout(() => {
				if (document.hidden) {
					authStore.logout();
				}
			}, 5 * 60 * 1000); // 5 minutes if tab is hidden
		}
	});
}
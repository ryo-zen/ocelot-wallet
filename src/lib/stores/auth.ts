import { writable, get } from 'svelte/store';

interface AuthState {
	wallet: string | null;
	encryptedPassword: string | null;
	isAuthenticated: boolean;
	sessionExpiry: number | null;
}

// Load persisted session from storage
function loadPersistedSession(): AuthState {
	if (typeof window === 'undefined') {
		return {
			wallet: null,
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
				console.log('Restored session from storage:', parsed.wallet);
				return parsed;
			} else {
				console.log('Stored session expired, clearing');
				sessionStorage.removeItem('wallet_session');
			}
		}
	} catch (e) {
		console.log('Failed to load persisted session:', e);
		sessionStorage.removeItem('wallet_session');
	}
	
	return {
		wallet: null,
		encryptedPassword: null,
		isAuthenticated: false,
		sessionExpiry: null
	};
}

const initialState: AuthState = loadPersistedSession();

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

// Session timeout (30 minutes - less aggressive)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function createAuthStore() {
	const store = writable<AuthState>(initialState);
	const { subscribe, set, update } = store;
	let sessionTimer: number | null = null;

	// Persist state to sessionStorage whenever it changes
	function persistSession(state: AuthState) {
		if (typeof window !== 'undefined') {
			try {
				if (state.isAuthenticated) {
					sessionStorage.setItem('wallet_session', JSON.stringify(state));
					console.log('Session persisted to storage');
				} else {
					sessionStorage.removeItem('wallet_session');
					console.log('Session removed from storage');
				}
			} catch (e) {
				console.error('Failed to persist session:', e);
			}
		}
	}

	// Auto-logout on session timeout
	function startSessionTimer() {
		console.log('startSessionTimer called - timeout in', SESSION_TIMEOUT_MS / 1000, 'seconds');
		if (sessionTimer) {
			console.log('Clearing existing session timer');
			clearTimeout(sessionTimer);
		}
		sessionTimer = setTimeout(() => {
			console.log('Session timer expired - calling logout');
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
		const clearedState = {
			wallet: null,
			encryptedPassword: null,
			isAuthenticated: false,
			sessionExpiry: null
		};
		update(state => {
			if (state.encryptedPassword) {
				// Overwrite encrypted password with random data
				state.encryptedPassword = btoa(Math.random().toString(36) + Math.random().toString(36));
			}
			return clearedState;
		});
		persistSession(clearedState);

		// Force garbage collection hint
		if ('gc' in window && typeof (window as any).gc === 'function') {
			(window as any).gc();
		}
	}

	// Check if session is expired (without auto-logout)
	function isSessionExpired(): boolean {
		const currentState = get(store);
		
		if (!currentState.isAuthenticated || !currentState.sessionExpiry) {
			return true;
		}

		return Date.now() > currentState.sessionExpiry;
	}

	// Check session validity (for internal use only)
	function isSessionValid(): boolean {
		const currentState = get(store);
		
		if (!currentState.isAuthenticated || !currentState.sessionExpiry) {
			return false;
		}

		return Date.now() <= currentState.sessionExpiry;
	}

	return {
		subscribe,
		login: (wallet: string, password: string) => {
			const sessionExpiry = Date.now() + SESSION_TIMEOUT_MS;
			const newState = {
				wallet,
				encryptedPassword: encryptPassword(password),
				isAuthenticated: true,
				sessionExpiry
			};
			set(newState);
			persistSession(newState);
			
			// Clear password from parameter immediately
			password = '';
			
			startSessionTimer();
		},
		logout,
		getCredentials: () => {
			const currentState = get(store);
			
			// If session expired, return expired status but don't auto-logout
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
				password: currentState.encryptedPassword ? decryptPassword(currentState.encryptedPassword) : null,
				isAuthenticated: currentState.isAuthenticated,
				sessionExpired: false
			};
		},
		refreshSession: () => {
			// Always refresh session if user is authenticated, even if expired
			const currentState = get(store);
			
			console.log('refreshSession - currentState:', {
				isAuthenticated: currentState.isAuthenticated,
				wallet: currentState.wallet,
				hasEncryptedPassword: !!currentState.encryptedPassword,
				sessionExpiry: currentState.sessionExpiry,
				now: Date.now()
			});
			
			if (currentState.isAuthenticated && currentState.wallet && currentState.encryptedPassword) {
				console.log('refreshSession - updating session expiry');
				const refreshedState = {
					...currentState,
					sessionExpiry: Date.now() + SESSION_TIMEOUT_MS
				};
				update(state => refreshedState);
				persistSession(refreshedState);
				startSessionTimer();
				return true; // Session refreshed successfully
			}
			console.log('refreshSession - cannot refresh, missing auth data');
			return false; // Cannot refresh - no valid auth state
		},
		// Add line numbers for debugging
		debugGetCurrentLine: () => console.log('This is around line 170')
	};
}

export const authStore = createAuthStore();

// ALL AUTOMATIC LOGOUT DISABLED FOR DEBUGGING
// Auto-logout on page unload/close - DISABLED
// if (typeof window !== 'undefined') {
// 	window.addEventListener('beforeunload', () => {
// 		console.log('beforeunload event - logging out');
// 		authStore.logout();
// 	});
// }
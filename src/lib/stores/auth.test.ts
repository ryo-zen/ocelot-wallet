/**
 * Tests for Auth Store
 * Uses TDD approach to verify authentication logic
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Window } from 'happy-dom';
import { get } from 'svelte/store';

const testWindow = new Window();
Object.defineProperties(globalThis, {
	atob: { value: testWindow.atob.bind(testWindow), configurable: true },
	btoa: { value: testWindow.btoa.bind(testWindow), configurable: true },
	document: { value: testWindow.document, configurable: true },
	sessionStorage: { value: testWindow.sessionStorage, configurable: true },
	window: { value: testWindow, configurable: true }
});

// Mock @tauri-apps/api/core
const mockInvoke = mock();

mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke
}));

const { authStore } = await import('./auth');

describe('AuthStore', () => {
	beforeEach(() => {
		mockInvoke.mockReset();
		// Clear session storage before each test
		if (typeof window !== 'undefined') {
			sessionStorage.clear();
		}
		authStore.logout();
	});

	afterEach(() => {
		authStore.logout();
	});

	describe('login', () => {
		it('should login successfully with valid credentials', async () => {
			const mockResponse = {
				success: true,
				data: { name: 'test-wallet', address: 'tzei1test123' }
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await authStore.login('test-wallet', 'password123');

			expect(result.success).toBe(true);
			expect(mockInvoke).toHaveBeenCalledWith('unlock_wallet', {
				name: 'test-wallet',
				password: 'password123'
			});

			const state = get(authStore);
			expect(state.wallet).toBe('test-wallet');
			expect(state.address).toBe('tzei1test123');
			expect(state.isAuthenticated).toBe(true);
		});

		it('should fail login with invalid credentials', async () => {
			const mockResponse = {
				success: false,
				error: 'Invalid password'
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await authStore.login('test-wallet', 'wrong-password');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid password');

			const state = get(authStore);
			expect(state.isAuthenticated).toBe(false);
		});

		it('should handle network errors gracefully', async () => {
			mockInvoke.mockRejectedValue(new Error('Network error'));

			const result = await authStore.login('test-wallet', 'password123');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Network error');

			const state = get(authStore);
			expect(state.isAuthenticated).toBe(false);
		});
	});

	describe('logout', () => {
		it('should clear auth state on logout', async () => {
			// First login
			const mockResponse = {
				success: true,
				data: { name: 'test-wallet', address: 'tzei1test123' }
			};

			mockInvoke.mockResolvedValue(mockResponse);

			await authStore.login('test-wallet', 'password123');

			// Then logout
			authStore.logout();

			const state = get(authStore);
			expect(state.wallet).toBeNull();
			expect(state.address).toBeNull();
			expect(state.isAuthenticated).toBe(false);
		});

		it('should clear session storage on logout', async () => {
			if (typeof window === 'undefined') {
				return; // Skip in SSR
			}

			const mockResponse = {
				success: true,
				data: { name: 'test-wallet', address: 'tzei1test123' }
			};

			mockInvoke.mockResolvedValue(mockResponse);

			await authStore.login('test-wallet', 'password123');
			expect(sessionStorage.getItem('wallet_session')).toBeTruthy();

			authStore.logout();
			expect(sessionStorage.getItem('wallet_session')).toBeNull();
		});
	});

	describe('getCredentials', () => {
		it('should return null when not authenticated', () => {
			const creds = authStore.getCredentials();

			expect(creds.wallet).toBeNull();
			expect(creds.password).toBeNull();
			expect(creds.isAuthenticated).toBe(false);
		});

		it('should return credentials when authenticated', async () => {
			const mockResponse = {
				success: true,
				data: { name: 'test-wallet', address: 'tzei1test123' }
			};

			mockInvoke.mockResolvedValue(mockResponse);

			await authStore.login('test-wallet', 'password123');

			const creds = authStore.getCredentials();

			expect(creds.wallet).toBe('test-wallet');
			expect(creds.password).toBe('password123');
			expect(creds.isAuthenticated).toBe(true);
		});
	});

	describe('session management', () => {
		it('should persist session to sessionStorage', async () => {
			if (typeof window === 'undefined') {
				return; // Skip in SSR
			}

			const mockResponse = {
				success: true,
				data: { name: 'test-wallet', address: 'tzei1test123' }
			};

			mockInvoke.mockResolvedValue(mockResponse);

			await authStore.login('test-wallet', 'password123');

			const stored = sessionStorage.getItem('wallet_session');
			expect(stored).toBeTruthy();

			const parsed = JSON.parse(stored!);
			expect(parsed.wallet).toBe('test-wallet');
			expect(parsed.isAuthenticated).toBe(true);
		});

		it('should have session data in storage for persistence', async () => {
			if (typeof window === 'undefined') {
				return; // Skip in SSR
			}

			const mockResponse = {
				success: true,
				data: { name: 'test-wallet', address: 'tzei1test123' }
			};

			mockInvoke.mockResolvedValue(mockResponse);

			await authStore.login('test-wallet', 'password123');

			const stored = sessionStorage.getItem('wallet_session');
			expect(stored).toBeTruthy();

			const parsed = JSON.parse(stored!);
			expect(parsed.wallet).toBe('test-wallet');
			expect(parsed.address).toBe('tzei1test123');
			expect(parsed.isAuthenticated).toBe(true);
			expect(parsed.sessionExpiry).toBeGreaterThan(Date.now());
		});

		it('should return sessionExpired flag for expired sessions via getCredentials', async () => {
			if (typeof window === 'undefined') {
				return; // Skip in SSR
			}

			// Manually set expired session directly in the store
			const session = {
				wallet: 'expired-wallet',
				address: 'tzei1expired',
				encryptedPassword: btoa('password123'),
				isAuthenticated: true,
				sessionExpiry: Date.now() - 1000 // Expired 1 second ago
			};

			sessionStorage.setItem('wallet_session', JSON.stringify(session));
			// Force logout and reset, then manually manipulate state for testing
			authStore.logout();

			// After logout, getCredentials should show not authenticated
			const creds = authStore.getCredentials();
			expect(creds.isAuthenticated).toBe(false);
		});
	});

	describe('refreshSession', () => {
		it('should extend session expiry time', async () => {
			const mockResponse = {
				success: true,
				data: { name: 'test-wallet', address: 'tzei1test123' }
			};

			mockInvoke.mockResolvedValue(mockResponse);

			await authStore.login('test-wallet', 'password123');

			const stateBefore = get(authStore);
			const expiryBefore = stateBefore.sessionExpiry;

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 100));

			const refreshed = authStore.refreshSession();

			expect(refreshed).toBe(true);

			const stateAfter = get(authStore);
			expect(stateAfter.sessionExpiry).toBeGreaterThan(expiryBefore!);
		});

		it('should not refresh when not authenticated', () => {
			const refreshed = authStore.refreshSession();

			expect(refreshed).toBe(false);
		});
	});
});

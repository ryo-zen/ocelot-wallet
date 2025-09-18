/**
 * Wallet Registration Service
 * Handles automatic synchronization of wallet files with PostgreSQL database
 */

import { authStore } from '$lib/stores/auth.js';

export interface WalletRegistrationResult {
	success: boolean;
	walletName: string;
	address?: string;
	error?: string;
	alreadyExists?: boolean;
}

export class WalletRegistrationService {
	/**
	 * Get wallet address from CLI Bridge
	 */
	private async getWalletAddressFromCliBridge(walletName: string, password: string): Promise<string> {
		try {
			const response = await fetch('http://127.0.0.1:8081/ws', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					command: 'address',
					wallet: walletName,
					password: password
				})
			});

			if (!response.ok) {
				throw new Error(`CLI Bridge error: ${response.status}`);
			}

			const result = await response.json();

			if (result.error) {
				throw new Error(result.error);
			}

			if (!result.address) {
				throw new Error('No address returned from CLI Bridge');
			}

			return result.address;
		} catch (error) {
			throw new Error(`Failed to get address from CLI Bridge: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Register wallet in database
	 */
	private async registerWalletInDatabase(walletName: string, address: string, walletFilePath?: string): Promise<void> {
		try {
			const response = await fetch('/api/wallets/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					walletName,
					address,
					walletFilePath: walletFilePath || null
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `Database registration failed: ${response.status}`);
			}

			const result = await response.json();
			if (!result.success) {
				throw new Error(result.error || 'Database registration failed');
			}
		} catch (error) {
			throw new Error(`Failed to register wallet in database: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check if wallet already exists in database
	 */
	private async isWalletRegistered(walletName: string): Promise<boolean> {
		try {
			const response = await fetch('/api/wallets/addresses');
			if (!response.ok) return false;

			const result = await response.json();
			return result.success && result.walletAddresses && result.walletAddresses[walletName];
		} catch {
			return false;
		}
	}

	/**
	 * Register a newly created wallet automatically
	 * Called during wallet creation flow
	 */
	async registerNewWallet(walletName: string, password: string, walletFilePath?: string): Promise<WalletRegistrationResult> {
		try {
			// Check if already registered
			const alreadyExists = await this.isWalletRegistered(walletName);
			if (alreadyExists) {
				return {
					success: true,
					walletName,
					alreadyExists: true
				};
			}

			// Get address from CLI Bridge
			const address = await this.getWalletAddressFromCliBridge(walletName, password);

			// Register in database
			await this.registerWalletInDatabase(walletName, address, walletFilePath);

			return {
				success: true,
				walletName,
				address
			};

		} catch (error) {
			return {
				success: false,
				walletName,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Sync existing wallet files that aren't in database
	 * Called by admin/sync utilities
	 */
	async syncExistingWallets(): Promise<WalletRegistrationResult[]> {
		try {
			// Get discovered wallet files
			const response = await fetch('/api/wallets');
			if (!response.ok) {
				throw new Error('Failed to get wallet list');
			}

			const walletData = await response.json();
			if (!walletData.success) {
				throw new Error('Failed to get wallet list');
			}

			const discoveredWallets = walletData.wallets || [];

			// Get already registered wallets
			const addressResponse = await fetch('/api/wallets/addresses');
			const addressData = addressResponse.ok ? await addressResponse.json() : { walletAddresses: {} };
			const registeredWallets = Object.keys(addressData.walletAddresses || {});

			// Find unregistered wallets
			const unregisteredWallets = discoveredWallets.filter(
				(wallet: string) => !registeredWallets.includes(wallet)
			);

			console.log(`Found ${unregisteredWallets.length} unregistered wallets:`, unregisteredWallets);

			// Note: Cannot auto-sync existing wallets without passwords
			// This would require CLI Bridge integration or password prompts
			const results: WalletRegistrationResult[] = [];

			for (const walletName of unregisteredWallets) {
				results.push({
					success: false,
					walletName,
					error: 'Cannot auto-sync existing wallet without password - requires manual registration'
				});
			}

			return results;

		} catch (error) {
			throw new Error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Register current authenticated wallet if not already registered
	 * Called when user logs into existing wallet
	 */
	async registerCurrentWalletIfNeeded(): Promise<WalletRegistrationResult | null> {
		try {
			const credentials = authStore.getCredentials();
			if (!credentials.wallet || !credentials.password || !credentials.isAuthenticated) {
				return null;
			}

			const alreadyExists = await this.isWalletRegistered(credentials.wallet);
			if (alreadyExists) {
				return null; // Already registered
			}

			// Auto-register the current authenticated wallet
			return await this.registerNewWallet(credentials.wallet, credentials.password);

		} catch (error) {
			return {
				success: false,
				walletName: '',
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Batch register multiple wallets (admin utility)
	 */
	async batchRegisterWallets(wallets: Array<{ name: string; password: string; filePath?: string }>): Promise<WalletRegistrationResult[]> {
		const results: WalletRegistrationResult[] = [];

		for (const wallet of wallets) {
			const result = await this.registerNewWallet(wallet.name, wallet.password, wallet.filePath);
			results.push(result);

			// Add small delay to avoid overwhelming CLI Bridge
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		return results;
	}
}

// Export singleton
export const walletRegistrationService = new WalletRegistrationService();
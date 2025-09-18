import { readdir, stat, access, constants } from 'fs/promises';
import { existsSync, watch } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { loadWalletConfig, validateWalletConfig, getConfigSummary, type WalletConfig } from '$lib/config/wallet-config.js';

interface WalletInfo {
	name: string;
	path: string;
	size: number;
	modified: Date;
	isValid: boolean;
	isAccessible: boolean;
}

class WalletDiscoveryService extends EventEmitter {
	private config: WalletConfig;
	private cache: Map<string, WalletInfo[]> = new Map();
	private lastScan: Map<string, number> = new Map();
	private watchers: Map<string, any> = new Map();
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

	constructor(configOverrides?: Partial<WalletConfig>) {
		super();

		// Load configuration from environment variables
		const envConfig = loadWalletConfig();

		// Apply overrides if provided
		this.config = { ...envConfig, ...configOverrides };

		// Validate configuration
		const configErrors = validateWalletConfig(this.config);
		if (configErrors.length > 0) {
			console.warn('Wallet discovery configuration issues:', configErrors);
		}

		// Debug output
		if (this.config.debug) {
			console.log(getConfigSummary(this.config));
		}

		// Initialize file watchers if enabled
		if (this.config.watchForChanges) {
			this.initializeWatchers();
		}
	}


	/**
	 * Initialize file system watchers for all configured directories
	 */
	private async initializeWatchers(): Promise<void> {
		for (const directory of this.config.directories) {
			if (existsSync(directory)) {
				try {
					const watcher = watch(directory, { recursive: this.config.recursive },
						(eventType, filename) => {
							if (filename && filename.endsWith('.wallet')) {
								this.debouncedDirectoryUpdate(directory);
							}
						}
					);
					this.watchers.set(directory, watcher);
				} catch (error) {
					console.warn(`Could not watch directory ${directory}:`, error);
				}
			}
		}
	}

	/**
	 * Debounced directory update to prevent excessive file system events
	 */
	private debouncedDirectoryUpdate(directory: string): void {
		const existingTimer = this.debounceTimers.get(directory);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(() => {
			this.invalidateCache(directory);
			this.emit('walletsChanged', { directory });
			this.debounceTimers.delete(directory);
		}, 500); // 500ms debounce

		this.debounceTimers.set(directory, timer);
	}

	/**
	 * Discover all .wallet files from configured directories
	 */
	async discoverWallets(): Promise<WalletInfo[]> {
		const allWallets: WalletInfo[] = [];
		const seenNames = new Set<string>();

		for (const directory of this.config.directories) {
			if (!existsSync(directory)) {
				continue;
			}

			// Check cache first
			const cached = this.getCachedWallets(directory);
			if (cached) {
				for (const wallet of cached) {
					if (!seenNames.has(wallet.name)) {
						allWallets.push(wallet);
						seenNames.add(wallet.name);
					}
				}
				continue;
			}

			// Scan directory
			try {
				const wallets = await this.scanDirectory(directory);
				this.cache.set(directory, wallets);
				this.lastScan.set(directory, Date.now());

				// Add unique wallets
				for (const wallet of wallets) {
					if (!seenNames.has(wallet.name)) {
						allWallets.push(wallet);
						seenNames.add(wallet.name);
					}
				}
			} catch (error) {
				console.warn(`Error scanning directory ${directory}:`, error);
			}
		}

		return allWallets.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get cached wallets if they're still valid
	 */
	private getCachedWallets(directory: string): WalletInfo[] | null {
		const cached = this.cache.get(directory);
		const lastScan = this.lastScan.get(directory);

		if (cached && lastScan && (Date.now() - lastScan) < this.config.cacheTimeout) {
			return cached;
		}

		return null;
	}

	/**
	 * Scan a specific directory for .wallet files
	 */
	private async scanDirectory(directory: string): Promise<WalletInfo[]> {
		const wallets: WalletInfo[] = [];

		try {
			await access(directory, constants.R_OK);
		} catch {
			console.warn(`Cannot access directory: ${directory}`);
			return wallets;
		}

		const items = await readdir(directory, { withFileTypes: true });

		for (const item of items) {
			const fullPath = path.join(directory, item.name);

			if (item.isFile() && item.name.endsWith('.wallet')) {
				// Process .wallet file
				const walletInfo = await this.processWalletFile(fullPath);
				if (walletInfo) {
					wallets.push(walletInfo);
				}
			} else if (item.isDirectory() && this.config.recursive) {
				// Recursively scan subdirectories
				const subWallets = await this.scanDirectory(fullPath);
				wallets.push(...subWallets);
			}
		}

		return wallets;
	}

	/**
	 * Process a single .wallet file and extract information
	 */
	private async processWalletFile(filePath: string): Promise<WalletInfo | null> {
		try {
			const stats = await stat(filePath);
			const name = path.basename(filePath, '.wallet');

			const walletInfo: WalletInfo = {
				name,
				path: filePath,
				size: stats.size,
				modified: stats.mtime,
				isValid: false,
				isAccessible: false
			};

			// Basic validation - check if file is readable
			try {
				await access(filePath, constants.R_OK);
				walletInfo.isAccessible = true;
			} catch {
				console.warn(`Wallet file not accessible: ${filePath}`);
			}

			// Validate wallet file structure if enabled
			if (this.config.validateWallets && walletInfo.isAccessible) {
				walletInfo.isValid = await this.validateWalletFile(filePath);
			} else {
				walletInfo.isValid = walletInfo.isAccessible;
			}

			// Test CLI Bridge access if enabled
			if (this.config.testCliAccess && walletInfo.isValid) {
				const cliAccessible = await this.testCliAccess(name);
				if (!cliAccessible) {
					console.warn(`Wallet ${name} not accessible via CLI Bridge`);
				}
			}

			return walletInfo;
		} catch (error) {
			console.warn(`Error processing wallet file ${filePath}:`, error);
			return null;
		}
	}

	/**
	 * Validate wallet file structure (basic checks)
	 */
	private async validateWalletFile(filePath: string): Promise<boolean> {
		try {
			// Basic size check - wallet files should not be empty or too small
			const stats = await stat(filePath);
			if (stats.size < 50) { // Minimum reasonable size
				return false;
			}

			// Additional validation could include:
			// - JSON structure validation
			// - Encryption header checks
			// - File magic number validation
			// For now, basic size check is sufficient

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Test if wallet is accessible via CLI Bridge
	 */
	private async testCliAccess(walletName: string): Promise<boolean> {
		try {
			// This would test CLI Bridge connectivity
			// Implementation depends on CLI Bridge API
			// For now, return true as this is optional
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get simple wallet names list (for backward compatibility)
	 */
	async getWalletNames(): Promise<string[]> {
		const wallets = await this.discoverWallets();
		return wallets
			.filter(wallet => wallet.isValid)
			.map(wallet => wallet.name);
	}

	/**
	 * Invalidate cache for a specific directory or all directories
	 */
	private invalidateCache(directory?: string): void {
		if (directory) {
			this.cache.delete(directory);
			this.lastScan.delete(directory);
		} else {
			this.cache.clear();
			this.lastScan.clear();
		}
	}

	/**
	 * Refresh cache for all directories
	 */
	async refreshCache(): Promise<void> {
		this.invalidateCache();
		await this.discoverWallets();
	}

	/**
	 * Get discovered directories (for debugging)
	 */
	getConfiguredDirectories(): string[] {
		return [...this.config.directories];
	}

	/**
	 * Get existing directories (for debugging)
	 */
	getExistingDirectories(): string[] {
		return this.config.directories.filter(dir => existsSync(dir));
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		// Clear debounce timers
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();

		// Close file watchers
		for (const watcher of this.watchers.values()) {
			watcher.close();
		}
		this.watchers.clear();

		// Clear caches
		this.invalidateCache();

		// Remove all listeners
		this.removeAllListeners();
	}
}

// Create singleton instance using environment configuration
export const walletDiscoveryService = new WalletDiscoveryService();

export { WalletDiscoveryService, type WalletInfo };
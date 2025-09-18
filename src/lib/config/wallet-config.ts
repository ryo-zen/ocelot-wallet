/**
 * Wallet Configuration Utility
 * Handles parsing environment variables for wallet discovery configuration
 */

export interface WalletConfig {
	directories: string[];
	cacheTimeout: number;
	recursive: boolean;
	watchForChanges: boolean;
	validateWallets: boolean;
	testCliAccess: boolean;
	debug: boolean;
	cliBridgeUrl: string;
}

/**
 * Parse environment variable as boolean
 */
function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (!value) return defaultValue;
	const lower = value.toLowerCase();
	return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on';
}

/**
 * Parse environment variable as number
 */
function parseNumberEnv(value: string | undefined, defaultValue: number): number {
	if (!value) return defaultValue;
	const parsed = parseInt(value, 10);
	return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as array (colon-separated)
 */
function parseArrayEnv(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(':')
		.map(item => item.trim())
		.filter(item => item.length > 0);
}

/**
 * Build wallet directories list from environment variables
 */
function buildWalletDirectories(): string[] {
	const directories: string[] = [];

	// 1. Primary environment variable (colon-separated)
	const envDirs = parseArrayEnv(process.env.ZEICOIN_WALLET_DIRS);
	directories.push(...envDirs);

	// 2. Legacy single directory variable
	const legacyDir = process.env.ZEICOIN_WALLET_DIR;
	if (legacyDir && legacyDir.trim()) {
		directories.push(legacyDir.trim());
	}

	// 3. Default directories if nothing configured
	if (directories.length === 0) {
		const defaultDirs = [
			'/home/max/zeicoin/zeicoin_data_testnet/wallets',
			'/home/max/.zeicoin/wallets',
			'/home/max/zeicoin/wallets',
			'./zeicoin_data_testnet/wallets',
			'./zeicoin/wallets',
			'../zeicoin/wallets',
			'../zeicoin/zeicoin_data_testnet/wallets'
		];
		directories.push(...defaultDirs);
	}

	// Remove duplicates
	return [...new Set(directories)];
}

/**
 * Load wallet configuration from environment variables
 */
export function loadWalletConfig(): WalletConfig {
	const config: WalletConfig = {
		directories: buildWalletDirectories(),
		cacheTimeout: parseNumberEnv(process.env.ZEICOIN_WALLET_DISCOVERY_CACHE_TIMEOUT, 30000),
		recursive: parseBooleanEnv(process.env.ZEICOIN_WALLET_DISCOVERY_RECURSIVE, true),
		watchForChanges: parseBooleanEnv(process.env.ZEICOIN_WALLET_DISCOVERY_WATCH, true),
		validateWallets: parseBooleanEnv(process.env.ZEICOIN_WALLET_DISCOVERY_VALIDATE, true),
		testCliAccess: parseBooleanEnv(process.env.ZEICOIN_CLI_BRIDGE_TEST_ACCESS, false),
		debug: parseBooleanEnv(process.env.ZEICOIN_WALLET_DISCOVERY_DEBUG, false),
		cliBridgeUrl: process.env.ZEICOIN_CLI_BRIDGE_URL || process.env.CLI_BRIDGE_URL || 'http://127.0.0.1:8081'
	};

	if (config.debug) {
		console.log('Wallet Discovery Configuration:', {
			...config,
			directories: config.directories.length
		});
		console.log('Configured directories:', config.directories);
	}

	return config;
}

/**
 * Validate wallet configuration
 */
export function validateWalletConfig(config: WalletConfig): string[] {
	const errors: string[] = [];

	if (config.directories.length === 0) {
		errors.push('No wallet directories configured');
	}

	if (config.cacheTimeout < 1000) {
		errors.push('Cache timeout too low (minimum 1000ms)');
	}

	if (config.cacheTimeout > 300000) {
		errors.push('Cache timeout too high (maximum 300000ms / 5 minutes)');
	}

	if (!config.cliBridgeUrl) {
		errors.push('CLI Bridge URL not configured');
	}

	return errors;
}

/**
 * Get configuration summary for debugging
 */
export function getConfigSummary(config: WalletConfig): string {
	const existingDirs = config.directories.filter(dir => {
		try {
			return require('fs').existsSync(dir);
		} catch {
			return false;
		}
	});

	return `
Wallet Discovery Configuration Summary:
- Total directories: ${config.directories.length}
- Existing directories: ${existingDirs.length}
- Cache timeout: ${config.cacheTimeout}ms
- Recursive scanning: ${config.recursive}
- File watching: ${config.watchForChanges}
- Wallet validation: ${config.validateWallets}
- CLI Bridge testing: ${config.testCliAccess}
- Debug mode: ${config.debug}
- CLI Bridge URL: ${config.cliBridgeUrl}

Configured directories:
${config.directories.map((dir, i) => `  ${i + 1}. ${dir} ${existingDirs.includes(dir) ? '✓' : '✗'}`).join('\n')}

Existing directories:
${existingDirs.map((dir, i) => `  ${i + 1}. ${dir}`).join('\n') || '  (none)'}
`.trim();
}
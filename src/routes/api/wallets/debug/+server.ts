import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { walletDiscoveryService } from '$lib/services/wallet-discovery.js';
import { loadWalletConfig, getConfigSummary } from '$lib/config/wallet-config.js';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const action = url.searchParams.get('action') || 'summary';

		switch (action) {
			case 'summary':
				return await handleSummary();
			case 'config':
				return await handleConfig();
			case 'scan':
				return await handleScan();
			case 'test':
				return await handleTest();
			case 'refresh':
				return await handleRefresh();
			default:
				return json({ error: 'Invalid action. Use: summary, config, scan, test, or refresh' }, { status: 400 });
		}
	} catch (error) {
		console.error('Wallet debug error:', error);
		return json(
			{
				error: 'Debug operation failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

async function handleSummary() {
	const config = loadWalletConfig();
	const existingDirs = config.directories.filter(dir => existsSync(dir));
	const wallets = await walletDiscoveryService.getWalletNames();

	return json({
		summary: 'Wallet Discovery Debug Summary',
		configuration: {
			totalDirectories: config.directories.length,
			existingDirectories: existingDirs.length,
			cacheTimeout: config.cacheTimeout,
			recursive: config.recursive,
			watchForChanges: config.watchForChanges,
			validateWallets: config.validateWallets,
			testCliAccess: config.testCliAccess,
			debug: config.debug
		},
		directories: {
			configured: config.directories,
			existing: existingDirs,
			missing: config.directories.filter(dir => !existsSync(dir))
		},
		wallets: {
			count: wallets.length,
			names: wallets
		},
		service: {
			configuredDirectories: walletDiscoveryService.getConfiguredDirectories(),
			existingDirectories: walletDiscoveryService.getExistingDirectories()
		}
	});
}

async function handleConfig() {
	const config = loadWalletConfig();

	return json({
		configSummary: getConfigSummary(config),
		rawConfig: config,
		environmentVariables: {
			ZEICOIN_WALLET_DIRS: process.env.ZEICOIN_WALLET_DIRS || null,
			ZEICOIN_WALLET_DIR: process.env.ZEICOIN_WALLET_DIR || null,
			ZEICOIN_WALLET_DISCOVERY_CACHE_TIMEOUT: process.env.ZEICOIN_WALLET_DISCOVERY_CACHE_TIMEOUT || null,
			ZEICOIN_WALLET_DISCOVERY_RECURSIVE: process.env.ZEICOIN_WALLET_DISCOVERY_RECURSIVE || null,
			ZEICOIN_WALLET_DISCOVERY_WATCH: process.env.ZEICOIN_WALLET_DISCOVERY_WATCH || null,
			ZEICOIN_WALLET_DISCOVERY_VALIDATE: process.env.ZEICOIN_WALLET_DISCOVERY_VALIDATE || null,
			ZEICOIN_CLI_BRIDGE_TEST_ACCESS: process.env.ZEICOIN_CLI_BRIDGE_TEST_ACCESS || null,
			ZEICOIN_WALLET_DISCOVERY_DEBUG: process.env.ZEICOIN_WALLET_DISCOVERY_DEBUG || null,
			ZEICOIN_CLI_BRIDGE_URL: process.env.ZEICOIN_CLI_BRIDGE_URL || null
		}
	});
}

async function handleScan() {
	const wallets = await walletDiscoveryService.discoverWallets();
	const config = loadWalletConfig();

	// Scan each directory manually for comparison
	const manualScan = await Promise.all(
		config.directories.map(async (dir) => {
			if (!existsSync(dir)) {
				return { directory: dir, status: 'not_found', files: [] };
			}

			try {
				const files = await readdir(dir);
				const walletFiles = files.filter(file => file.endsWith('.wallet'));

				return {
					directory: dir,
					status: 'success',
					totalFiles: files.length,
					walletFiles: walletFiles,
					walletCount: walletFiles.length
				};
			} catch (error) {
				return {
					directory: dir,
					status: 'error',
					error: error instanceof Error ? error.message : 'Unknown error'
				};
			}
		})
	);

	return json({
		discoveredWallets: wallets,
		manualDirectoryScan: manualScan,
		comparison: {
			discoveredCount: wallets.length,
			manualScanTotal: manualScan.reduce((total, scan) =>
				total + (scan.status === 'success' ? scan.walletCount || 0 : 0), 0
			)
		}
	});
}

async function handleTest() {
	const startTime = Date.now();

	// Test multiple operations
	const results = {
		getWalletNames: {
			startTime: Date.now(),
			result: null as any,
			duration: 0,
			error: null as string | null
		},
		discoverWallets: {
			startTime: Date.now(),
			result: null as any,
			duration: 0,
			error: null as string | null
		},
		refreshCache: {
			startTime: Date.now(),
			result: null as any,
			duration: 0,
			error: null as string | null
		}
	};

	// Test getWalletNames
	try {
		results.getWalletNames.startTime = Date.now();
		results.getWalletNames.result = await walletDiscoveryService.getWalletNames();
		results.getWalletNames.duration = Date.now() - results.getWalletNames.startTime;
	} catch (error) {
		results.getWalletNames.error = error instanceof Error ? error.message : 'Unknown error';
		results.getWalletNames.duration = Date.now() - results.getWalletNames.startTime;
	}

	// Test discoverWallets
	try {
		results.discoverWallets.startTime = Date.now();
		results.discoverWallets.result = await walletDiscoveryService.discoverWallets();
		results.discoverWallets.duration = Date.now() - results.discoverWallets.startTime;
	} catch (error) {
		results.discoverWallets.error = error instanceof Error ? error.message : 'Unknown error';
		results.discoverWallets.duration = Date.now() - results.discoverWallets.startTime;
	}

	// Test refreshCache
	try {
		results.refreshCache.startTime = Date.now();
		await walletDiscoveryService.refreshCache();
		results.refreshCache.result = 'Cache refreshed successfully';
		results.refreshCache.duration = Date.now() - results.refreshCache.startTime;
	} catch (error) {
		results.refreshCache.error = error instanceof Error ? error.message : 'Unknown error';
		results.refreshCache.duration = Date.now() - results.refreshCache.startTime;
	}

	const totalDuration = Date.now() - startTime;

	return json({
		testResults: results,
		summary: {
			totalDuration,
			testsRun: 3,
			testsPassed: Object.values(results).filter(r => !r.error).length,
			testsFailed: Object.values(results).filter(r => r.error).length
		}
	});
}

async function handleRefresh() {
	const startTime = Date.now();

	await walletDiscoveryService.refreshCache();
	const wallets = await walletDiscoveryService.getWalletNames();

	const duration = Date.now() - startTime;

	return json({
		message: 'Cache refreshed successfully',
		duration,
		walletCount: wallets.length,
		wallets
	});
}
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { walletDiscoveryService } from '$lib/services/wallet-discovery.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Check for debug/detailed mode
		const detailed = url.searchParams.get('detailed') === 'true';
		const refresh = url.searchParams.get('refresh') === 'true';

		// Force refresh cache if requested
		if (refresh) {
			await walletDiscoveryService.refreshCache();
		}

		if (detailed) {
			// Return detailed wallet information
			const walletsInfo = await walletDiscoveryService.discoverWallets();

			return json({
				success: true,
				wallets: walletsInfo.map(w => w.name),
				walletsInfo: walletsInfo,
				configuredDirectories: walletDiscoveryService.getConfiguredDirectories(),
				existingDirectories: walletDiscoveryService.getExistingDirectories(),
				totalWallets: walletsInfo.length,
				validWallets: walletsInfo.filter(w => w.isValid).length
			});
		} else {
			// Return simple wallet names list (backward compatibility)
			const walletNames = await walletDiscoveryService.getWalletNames();

			return json({
				success: true,
				wallets: walletNames,
				totalWallets: walletNames.length
			});
		}

	} catch (error) {
		console.error('Wallet discovery error:', error);
		return json(
			{
				success: false,
				error: 'Failed to discover wallets',
				wallets: [],
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryDatabaseWithFields } from '$lib/server/database.js';

export const GET: RequestHandler = async () => {
	try {
		// Query the wallets table directly to get wallet name to address mappings
		const result = await queryDatabaseWithFields(
			`SELECT wallet_name, address FROM wallets WHERE is_active = true ORDER BY wallet_name`
		);

		// Parse the results and build wallet mappings
		const walletMappings: Record<string, string> = {};

		for (const line of result) {
			const fields = line.split('|');
			if (fields.length >= 2) {
				const walletName = fields[0];
				const address = fields[1];
				if (walletName && address) {
					walletMappings[walletName] = address;
				}
			}
		}

		return json({
			success: true,
			walletAddresses: walletMappings,
			totalWallets: Object.keys(walletMappings).length
		});

	} catch (error) {
		console.error('Wallet address mapping error:', error);
		return json(
			{
				error: 'Failed to get wallet addresses',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};


import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryDatabase } from '$lib/server/database.js';

export const GET: RequestHandler = async () => {
	try {
		// Query the database to get wallet addresses - optimized for speed
		const result = await queryDatabase(
			`SELECT address FROM accounts WHERE balance != 0 ORDER BY balance DESC LIMIT 10`
		);

		// Create a mapping of likely wallet names to addresses based on patterns or balance
		const walletMappings: Record<string, string> = {};
		
		// For now, we'll use a simple approach - map known addresses to wallet names
		// This could be enhanced by storing wallet names in the database or using other heuristics
		const knownWalletAddresses = {
			'tzei1qpt7k46yp9n8vlwx7mys92mplvsaj3hfsy5lrppw': 'sam'
		};

		// Build the reverse mapping (wallet name -> address)
		for (const account of result) {
			const walletName = knownWalletAddresses[account.address];
			if (walletName) {
				walletMappings[walletName] = account.address;
			}
		}

		return json({
			success: true,
			walletAddresses: walletMappings
		});

	} catch (error) {
		console.error('Wallet address mapping error:', error);
		return json(
			{ error: 'Failed to get wallet addresses' },
			{ status: 500 }
		);
	}
};


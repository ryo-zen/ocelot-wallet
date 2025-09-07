import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const GET: RequestHandler = async () => {
	try {
		// Common wallet directory paths to check
		const possibleWalletPaths = [
			'/home/max/zeicoin/zeicoin_data_testnet/wallets',
			'/home/max/.zeicoin/wallets',
			'/home/max/zeicoin/wallets', 
			'./zeicoin/wallets',
			'../zeicoin/wallets',
			process.env.ZEICOIN_WALLET_DIR || '/home/max/.zeicoin/wallets'
		];

		let walletDir = '';
		let wallets: string[] = [];

		// Find the correct wallet directory
		for (const walletPath of possibleWalletPaths) {
			if (existsSync(walletPath)) {
				walletDir = walletPath;
				break;
			}
		}

		if (walletDir) {
			try {
				const files = await readdir(walletDir);
				// Filter for wallet files (typically .json or .wallet files, or directories)
				wallets = files
					.filter(file => {
						const filePath = path.join(walletDir, file);
						// Check if it's a wallet file or directory
						return file.endsWith('.json') || file.endsWith('.wallet') || 
							   (!file.includes('.') && existsSync(filePath));
					})
					.map(file => {
						// Remove file extensions to get wallet names
						return file.replace(/\.(json|wallet)$/, '');
					});
			} catch (error) {
				console.error('Error reading wallet directory:', error);
			}
		}

		// If no wallets found in filesystem, return empty array
		// The frontend can handle this case appropriately
		return json({
			success: true,
			wallets: wallets.sort(), // Sort alphabetically
			walletDir: walletDir || 'not found'
		});

	} catch (error) {
		console.error('Wallet discovery error:', error);
		return json(
			{ 
				success: false, 
				error: 'Failed to discover wallets',
				wallets: []
			},
			{ status: 500 }
		);
	}
};
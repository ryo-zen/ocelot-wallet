import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryDatabaseWithFields } from '$lib/server/database.js';
import { walletDiscoveryService } from '$lib/services/wallet-discovery.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const action = url.searchParams.get('action') || 'status';

		switch (action) {
			case 'status':
				return await handleSyncStatus();
			case 'manual':
				return await handleManualSync();
			default:
				return json({ error: 'Invalid action. Use: status, manual' }, { status: 400 });
		}
	} catch (error) {
		console.error('Wallet sync error:', error);
		return json(
			{
				error: 'Sync operation failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { wallets } = body;

		if (!Array.isArray(wallets)) {
			return json(
				{ error: 'Invalid request body. Expected array of wallets with name and password.' },
				{ status: 400 }
			);
		}

		const results = [];
		let successCount = 0;
		let errorCount = 0;

		for (const wallet of wallets) {
			if (!wallet.name || !wallet.password) {
				results.push({
					walletName: wallet.name || 'unknown',
					success: false,
					error: 'Missing wallet name or password'
				});
				errorCount++;
				continue;
			}

			try {
				// Get address from CLI Bridge
				const address = await getWalletAddressFromCliBridge(wallet.name, wallet.password);

				// Register in database
				await registerWalletInDatabase(wallet.name, address);

				results.push({
					walletName: wallet.name,
					success: true,
					address: address
				});
				successCount++;

			} catch (error) {
				results.push({
					walletName: wallet.name,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
				errorCount++;
			}
		}

		return json({
			success: true,
			message: `Sync completed: ${successCount} successful, ${errorCount} failed`,
			results: results,
			summary: {
				total: wallets.length,
				successful: successCount,
				failed: errorCount
			}
		});

	} catch (error) {
		console.error('Batch sync error:', error);
		return json(
			{
				error: 'Batch sync failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

async function handleSyncStatus() {
	// Get discovered wallet files
	const discoveredWallets = await walletDiscoveryService.getWalletNames();

	// Get registered wallets from database
	const registeredResult = await queryDatabaseWithFields(
		`SELECT wallet_name FROM wallets WHERE is_active = true ORDER BY wallet_name`
	);
	const registeredWallets = registeredResult.map(line => line.split('|')[0]).filter(Boolean);

	// Find differences
	const unregisteredWallets = discoveredWallets.filter(
		wallet => !registeredWallets.includes(wallet)
	);

	const orphanedRegistrations = registeredWallets.filter(
		wallet => !discoveredWallets.includes(wallet)
	);

	return json({
		success: true,
		discoveredWallets: {
			count: discoveredWallets.length,
			wallets: discoveredWallets
		},
		registeredWallets: {
			count: registeredWallets.length,
			wallets: registeredWallets
		},
		syncStatus: {
			unregisteredWallets: {
				count: unregisteredWallets.length,
				wallets: unregisteredWallets
			},
			orphanedRegistrations: {
				count: orphanedRegistrations.length,
				wallets: orphanedRegistrations
			},
			inSync: unregisteredWallets.length === 0 && orphanedRegistrations.length === 0
		}
	});
}

async function handleManualSync() {
	// This endpoint provides information for manual sync
	// It doesn't perform automatic sync since we need passwords

	const statusResult = await handleSyncStatus();
	const statusData = await statusResult.json();

	return json({
		...statusData,
		instructions: {
			message: 'Manual sync required for unregistered wallets',
			steps: [
				'1. Use POST /api/wallets/sync with wallet names and passwords',
				'2. Or login to each wallet individually for auto-registration',
				'3. Or use the wallet registration API directly'
			],
			exampleRequest: {
				method: 'POST',
				url: '/api/wallets/sync',
				body: {
					wallets: [
						{ name: 'alice', password: 'your-password' },
						{ name: 'bob', password: 'your-password' }
					]
				}
			}
		}
	});
}

async function getWalletAddressFromCliBridge(walletName: string, password: string): Promise<string> {
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

async function registerWalletInDatabase(walletName: string, address: string): Promise<void> {
	// Check if already exists
	const existingCheck = await queryDatabaseWithFields(
		`SELECT wallet_name FROM wallets WHERE wallet_name = '${walletName.replace(/'/g, "''")}'`
	);

	if (existingCheck.length > 0) {
		return; // Already registered
	}

	// Insert new wallet
	const insertQuery = `
		INSERT INTO wallets (wallet_name, address, is_active, created_at)
		VALUES (
			'${walletName.replace(/'/g, "''")}',
			'${address.replace(/'/g, "''")}',
			true,
			NOW()
		)
	`;

	await queryDatabaseWithFields(insertQuery);
}
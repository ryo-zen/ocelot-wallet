import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryDatabaseWithFields } from '$lib/server/database.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { walletName, address, walletFilePath } = body;

		// Validate required fields
		if (!walletName || !address) {
			return json(
				{
					success: false,
					error: 'Missing required fields: walletName and address'
				},
				{ status: 400 }
			);
		}

		// Validate wallet name format (basic security)
		if (!/^[a-zA-Z0-9_-]+$/.test(walletName)) {
			return json(
				{
					success: false,
					error: 'Invalid wallet name format. Use only letters, numbers, underscore, and dash.'
				},
				{ status: 400 }
			);
		}

		// Validate address format (basic ZEI address validation)
		if (!address.startsWith('tzei1') || address.length !== 45) {
			return json(
				{
					success: false,
					error: 'Invalid ZEI address format'
				},
				{ status: 400 }
			);
		}

		// Check if wallet already exists
		const existingCheck = await queryDatabaseWithFields(
			`SELECT wallet_name FROM wallets WHERE wallet_name = '${walletName.replace(/'/g, "''")}'`
		);

		if (existingCheck.length > 0) {
			return json({
				success: true,
				message: 'Wallet already registered',
				walletName,
				address,
				alreadyExists: true
			});
		}

		// Check if address already exists (prevent duplicates)
		const addressCheck = await queryDatabaseWithFields(
			`SELECT wallet_name FROM wallets WHERE address = '${address.replace(/'/g, "''")}'`
		);

		if (addressCheck.length > 0) {
			const existingWallet = addressCheck[0];
			return json(
				{
					success: false,
					error: `Address already registered to wallet: ${existingWallet}`
				},
				{ status: 409 }
			);
		}

		// Insert new wallet into database
		const insertQuery = `
			INSERT INTO wallets (wallet_name, address, wallet_file_path, is_active, created_at)
			VALUES (
				'${walletName.replace(/'/g, "''")}',
				'${address.replace(/'/g, "''")}',
				${walletFilePath ? `'${walletFilePath.replace(/'/g, "''")}'` : 'NULL'},
				true,
				NOW()
			)
		`;

		await queryDatabaseWithFields(insertQuery);

		return json({
			success: true,
			message: 'Wallet registered successfully',
			walletName,
			address,
			walletFilePath
		});

	} catch (error) {
		console.error('Wallet registration error:', error);

		// Handle specific database errors
		let errorMessage = 'Failed to register wallet';
		if (error instanceof Error) {
			if (error.message.includes('duplicate key')) {
				errorMessage = 'Wallet name or address already exists';
			} else if (error.message.includes('connection')) {
				errorMessage = 'Database connection error';
			} else {
				errorMessage = error.message;
			}
		}

		return json(
			{
				success: false,
				error: errorMessage,
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const action = url.searchParams.get('action') || 'status';

		switch (action) {
			case 'status':
				// Get registration status summary
				const totalWallets = await queryDatabaseWithFields(
					`SELECT COUNT(*) as count FROM wallets WHERE is_active = true`
				);

				const recentRegistrations = await queryDatabaseWithFields(
					`SELECT wallet_name, address, created_at FROM wallets
					 WHERE is_active = true
					 ORDER BY created_at DESC
					 LIMIT 5`
				);

				const recent = recentRegistrations.map(line => {
					const fields = line.split('|');
					return {
						walletName: fields[0],
						address: fields[1],
						createdAt: fields[2]
					};
				});

				return json({
					success: true,
					totalRegisteredWallets: parseInt(totalWallets[0]?.split('|')[0] || '0'),
					recentRegistrations: recent
				});

			case 'sync':
				// Return sync status (would trigger background sync in production)
				return json({
					success: true,
					message: 'Sync feature requires implementation of background service',
					recommendation: 'Use POST /api/wallets/register to register individual wallets'
				});

			default:
				return json(
					{ error: 'Invalid action. Use: status, sync' },
					{ status: 400 }
				);
		}

	} catch (error) {
		console.error('Wallet registration status error:', error);
		return json(
			{
				success: false,
				error: 'Failed to get registration status'
			},
			{ status: 500 }
		);
	}
};
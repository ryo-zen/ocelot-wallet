import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryDatabaseWithFields } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ params }) => {
	const { address } = params;

	if (!address) {
		return json({ error: 'Address parameter is required' }, { status: 400 });
	}

	try {
		// Escape the address parameter for SQL safety
		const escapedAddress = address.replace(/'/g, "''");
		
		// Query the database using psql command - optimized for speed
		const lines = await queryDatabaseWithFields(
			`SELECT address, balance FROM accounts WHERE address = '${escapedAddress}'`
		);

		const result = lines.map(line => {
			const fields = line.split('|');
			return {
				address: fields[0] || null,
				balance: fields[1] ? BigInt(fields[1]) : null
			};
		});

		if (result.length === 0) {
			// Account not found in database - return zero balance account
			// This is normal for new wallets that haven't received any transactions yet
			return json({
				success: true,
				account: {
					address: address,
					balance: '0',
					nonce: '0',
					tx_count: 0,
					total_received: '0',
					total_sent: '0',
					first_seen_block: null,
					last_active_block: null,
					last_active_time: null,
					updated_at: new Date().toISOString()
				}
			});
		}

		const account = result[0];

		return json({
			success: true,
			account: {
				address: account.address,
				balance: account.balance?.toString() || '0'
			}
		});
	} catch (error) {
		console.error('Database query error:', error);
		return json(
			{ error: 'Failed to query database' },
			{ status: 500 }
		);
	}
};


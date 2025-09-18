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

		// Query to get transactions with L2 enhancements
		const query = `
			SELECT
				t.hash,
				t.block_timestamp,
				t.block_height,
				t.sender,
				t.recipient,
				t.amount,
				t.fee,
				t.nonce,
				t.message as base_message,
				l2.message as l2_message,
				l2.category,
				l2.tags,
				l2.reference_id,
				l2.is_private,
				l2.status,
				l2.temp_id,
				l2.created_at as l2_created_at,
				l2.confirmed_at,
				l2.metadata
			FROM transactions t
			LEFT JOIN l2_transaction_enhancements l2 ON t.hash = l2.tx_hash
			WHERE t.sender = '${escapedAddress}' OR t.recipient = '${escapedAddress}'
			ORDER BY t.block_timestamp DESC
			LIMIT 100;
		`;

		const lines = await queryDatabaseWithFields(query);

		// Parse the results
		const result = lines.map(line => {
			const fields = line.split('|');
			return {
				hash: fields[0] || null,
				block_timestamp: fields[1] || null,
				block_height: fields[2] || null,
				sender: fields[3] || null,
				recipient: fields[4] || null,
				amount: fields[5] || null,
				fee: fields[6] || null,
				nonce: fields[7] || null,
				base_message: fields[8] || null,
				l2_message: fields[9] || null,
				category: fields[10] || null,
				tags: fields[11] ? fields[11].replace(/[{}]/g, '').split(',').filter(t => t) : [],
				reference_id: fields[12] || null,
				is_private: fields[13] === 't',
				status: fields[14] || null,
				temp_id: fields[15] || null,
				l2_created_at: fields[16] || null,
				confirmed_at: fields[17] || null,
				metadata: fields[18] ? JSON.parse(fields[18]) : {}
			};
		});

		// Transform the data to match the expected format
		const transactions = result.map((row: any) => ({
			hash: row.hash,
			timestamp: row.block_timestamp, // Map block_timestamp to timestamp for frontend
			block_height: parseInt(row.block_height) || 0,
			sender: row.sender,
			recipient: row.recipient,
			amount: parseInt(row.amount) || 0,
			fee: parseInt(row.fee) || 0,
			nonce: row.nonce ? BigInt(row.nonce).toString() : '0',
			message: row.l2_message || row.base_message || null,
			// L2 enhancement fields
			category: row.category || null,
			tags: row.tags || [],
			reference_id: row.reference_id || null,
			is_private: row.is_private || false,
			status: row.status || 'confirmed',
			temp_id: row.temp_id || null,
			l2_created_at: row.l2_created_at || null,
			confirmed_at: row.confirmed_at || null,
			metadata: row.metadata || {}
		}));

		return json({
			success: true,
			transactions: transactions
		});
	} catch (error) {
		console.error('Transaction query error:', error);
		return json(
			{ error: 'Failed to query transactions' },
			{ status: 500 }
		);
	}
};


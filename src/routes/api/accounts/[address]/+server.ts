import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sqliteCache } from '$lib/server/sqlite-cache.js';
import { syncService } from '$lib/server/sync-service.js';
import { queryDatabaseWithFields } from '$lib/server/database.js';

/**
 * GET /api/accounts/[address]
 *
 * Cache-first balance lookup with sub-100ms response time
 * Falls back to PostgreSQL if cache miss
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { address } = params;

	if (!address) {
		return json({ error: 'Address parameter is required' }, { status: 400 });
	}

	const startTime = Date.now();
	const forceRefresh = url.searchParams.get('refresh') === 'true';

	try {
		// STEP 1: Try cache first (< 1ms)
		if (!forceRefresh) {
			const cached = sqliteCache.getBalance(address);

			if (cached) {
				const cacheAge = Date.now() - cached.updated_at;

				// If cache is fresh (< 30s), return immediately
				if (cacheAge < 30000) {
					const duration = Date.now() - startTime;
					console.log(`[API] Cache hit for ${address} (${duration}ms, age: ${cacheAge}ms)`);

					return json({
						success: true,
						account: {
							address: cached.address,
							balance: cached.balance.toString(),
							nonce: cached.nonce.toString(),
							tx_count: cached.tx_count,
							total_received: cached.total_received.toString(),
							total_sent: cached.total_sent.toString(),
							first_seen_block: cached.first_seen_block,
							last_active_block: cached.last_active_block,
							updated_at: new Date(cached.updated_at).toISOString()
						},
						cache: {
							hit: true,
							age_ms: cacheAge,
							query_time_ms: duration
						}
					});
				}
			}
		}

		// STEP 2: Cache miss or stale - fetch from PostgreSQL
		console.log(`[API] Cache miss for ${address}, querying PostgreSQL...`);

		const escapedAddress = address.replace(/'/g, "''");
		const lines = await queryDatabaseWithFields(
			`SELECT address, balance, nonce, tx_count, total_received, total_sent, first_seen_block, last_active_block
			 FROM accounts WHERE address = '${escapedAddress}'`
		);

		const duration = Date.now() - startTime;

		// Handle account not found
		if (lines.length === 0) {
			const defaultAccount = {
				address: address,
				balance: '0',
				nonce: '0',
				tx_count: 0,
				total_received: '0',
				total_sent: '0',
				first_seen_block: null,
				last_active_block: null,
				updated_at: new Date().toISOString()
			};

			// Cache the zero balance account
			sqliteCache.updateBalance({
				address,
				balance: BigInt(0),
				nonce: BigInt(0),
				tx_count: 0,
				total_received: BigInt(0),
				total_sent: BigInt(0)
			});

			return json({
				success: true,
				account: defaultAccount,
				cache: {
					hit: false,
					query_time_ms: duration
				}
			});
		}

		// Parse PostgreSQL result
		const fields = lines[0].split('|');
		const account = {
			address: fields[0] || address,
			balance: fields[1] || '0',
			nonce: fields[2] || '0',
			tx_count: fields[3] ? parseInt(fields[3]) : 0,
			total_received: fields[4] || '0',
			total_sent: fields[5] || '0',
			first_seen_block: fields[6] ? parseInt(fields[6]) : null,
			last_active_block: fields[7] ? parseInt(fields[7]) : null,
			updated_at: new Date().toISOString()
		};

		// STEP 3: Update cache for next time
		sqliteCache.updateBalance({
			address: account.address,
			balance: BigInt(account.balance),
			nonce: BigInt(account.nonce),
			tx_count: account.tx_count,
			total_received: BigInt(account.total_received),
			total_sent: BigInt(account.total_sent),
			first_seen_block: account.first_seen_block || undefined,
			last_active_block: account.last_active_block || undefined
		});

		console.log(`[API] PostgreSQL query for ${address} completed in ${duration}ms, cached`);

		return json({
			success: true,
			account,
			cache: {
				hit: false,
				query_time_ms: duration,
				updated: true
			}
		});

	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`[API] Account query error (${duration}ms):`, error);

		return json(
			{
				error: 'Failed to query account',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sqliteCache } from '$lib/server/sqlite-cache.js';
import { syncService } from '$lib/server/sync-service.js';

/**
 * GET /api/cache/status
 *
 * Returns SQLite cache health and sync status
 */
export const GET: RequestHandler = async () => {
	try {
		const status = syncService.getStatus();

		return json({
			success: true,
			cache: {
				...status.cache_stats,
				...status.cache_status,
				health: status.cache_status.is_stale ? 'stale' : 'fresh',
				sync_service: {
					is_running: status.is_running,
					is_syncing: status.is_syncing,
					interval_ms: status.sync_interval_ms
				}
			}
		});
	} catch (error) {
		return json(
			{
				error: 'Failed to get cache status',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};

/**
 * POST /api/cache/status
 *
 * Control cache operations
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'sync') {
			// Force immediate sync
			await syncService.syncNow();
			return json({
				success: true,
				message: 'Sync triggered successfully'
			});
		}

		if (action === 'sync_address' && body.address) {
			// Sync specific address
			await syncService.syncAddress(body.address, body.credentials);
			return json({
				success: true,
				message: `Address ${body.address} synced successfully`
			});
		}

		return json(
			{ error: 'Invalid action. Supported: sync, sync_address' },
			{ status: 400 }
		);
	} catch (error) {
		return json(
			{
				error: 'Failed to perform cache operation',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};

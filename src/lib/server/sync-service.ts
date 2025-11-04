/**
 * Background Sync Service
 *
 * Keeps SQLite cache synchronized with ZeiCoin node
 * Runs in the background without blocking UI
 */

import { sqliteCache } from './sqlite-cache.js';

export interface NodeAccountData {
  address: string;
  balance: string;
  nonce: string;
  first_seen_block?: number;
  last_active_block?: number;
  tx_count?: number;
  total_received?: string;
  total_sent?: string;
}

export interface NodeTransaction {
  hash: string;
  block_height: number;
  block_hash: string;
  position: number;
  sender: string;
  recipient: string;
  amount: string;
  fee: string;
  nonce: string;
  timestamp: number;
  message?: string;
  category?: string;
  reference_id?: string;
  tags?: string[];
}

class SyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private readonly syncIntervalMs = 10000; // 10 seconds
  private readonly cliNodeUrl = 'http://127.0.0.1:8081';

  /**
   * Start background sync service
   */
  start(): void {
    if (this.syncInterval) {
      console.log('[Sync Service] Already running');
      return;
    }

    console.log('[Sync Service] Starting background sync (every 10s)');

    // Initial sync
    this.syncNow().catch(err =>
      console.error('[Sync Service] Initial sync failed:', err)
    );

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.syncNow().catch(err =>
        console.error('[Sync Service] Sync failed:', err)
      );
    }, this.syncIntervalMs);
  }

  /**
   * Stop background sync service
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[Sync Service] Stopped');
    }
  }

  /**
   * Force immediate sync
   */
  async syncNow(): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync Service] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      const status = sqliteCache.getSyncStatus();

      // Only sync if cache is stale (> 30s old)
      if (!status.is_stale) {
        console.log(`[Sync Service] Cache is fresh (${status.cache_age_ms}ms old), skipping sync`);
        return;
      }

      console.log('[Sync Service] Starting sync...');

      // Get list of cached addresses to update
      const stats = sqliteCache.getStats();

      // For now, we'll implement a simple sync strategy
      // In production, you'd want to:
      // 1. Query node for latest block height
      // 2. Fetch new transactions since last_sync_block
      // 3. Update balances for affected addresses

      console.log(`[Sync Service] Cached data: ${stats.wallet_count} wallets, ${stats.transaction_count} transactions`);

      // Update sync state
      sqliteCache.updateSyncState(0); // We'll get actual block height from node

      const duration = Date.now() - startTime;
      console.log(`[Sync Service] Sync completed in ${duration}ms`);
    } catch (error) {
      console.error('[Sync Service] Sync error:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync specific address with node
   */
  async syncAddress(address: string, walletCredentials?: { name: string; password: string }): Promise<void> {
    try {
      console.log(`[Sync Service] Syncing address ${address}...`);

      // 1. Fetch balance from node
      const balance = await this.fetchBalanceFromNode(address, walletCredentials);

      if (balance) {
        sqliteCache.updateBalance({
          address: balance.address,
          balance: BigInt(balance.balance),
          nonce: BigInt(balance.nonce),
          tx_count: balance.tx_count || 0,
          total_received: BigInt(balance.total_received || '0'),
          total_sent: BigInt(balance.total_sent || '0'),
          first_seen_block: balance.first_seen_block,
          last_active_block: balance.last_active_block
        });
        console.log(`[Sync Service] Updated balance for ${address}`);
      }

      // 2. Fetch recent transactions
      // This would query your node's transaction API
      // const transactions = await this.fetchTransactionsFromNode(address);
      // if (transactions.length > 0) {
      //   sqliteCache.upsertTransactions(transactions.map(tx => ({ ...tx, amount: BigInt(tx.amount), fee: BigInt(tx.fee), nonce: BigInt(tx.nonce) })));
      // }

    } catch (error) {
      console.error(`[Sync Service] Failed to sync address ${address}:`, error);
      throw error;
    }
  }

  /**
   * Fetch balance from ZeiCoin node
   */
  private async fetchBalanceFromNode(
    address: string,
    credentials?: { name: string; password: string }
  ): Promise<NodeAccountData | null> {
    try {
      // Try database API first (faster)
      const dbResponse = await fetch(`http://localhost:5173/api/accounts/${address}`);

      if (dbResponse.ok) {
        const data = await dbResponse.json();
        if (data.success && data.account) {
          return {
            address: data.account.address,
            balance: data.account.balance.toString(),
            nonce: data.account.nonce.toString(),
            tx_count: data.account.tx_count,
            total_received: data.account.total_received?.toString(),
            total_sent: data.account.total_sent?.toString(),
            first_seen_block: data.account.first_seen_block,
            last_active_block: data.account.last_active_block
          };
        }
      }

      // Fallback to CLI Bridge if needed and credentials provided
      if (credentials) {
        const cliResponse = await fetch(`${this.cliNodeUrl}/ws`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'get_balance',
            params: {
              wallet: credentials.name,
              password: credentials.password
            }
          })
        });

        if (cliResponse.ok) {
          const result = await cliResponse.json();
          if (result.success) {
            return {
              address,
              balance: result.balance?.toString() || '0',
              nonce: '0',
              tx_count: 0
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[Sync Service] Failed to fetch balance:', error);
      return null;
    }
  }

  /**
   * Get sync service status
   */
  getStatus(): {
    is_running: boolean;
    is_syncing: boolean;
    sync_interval_ms: number;
    cache_status: ReturnType<typeof sqliteCache.getSyncStatus>;
    cache_stats: ReturnType<typeof sqliteCache.getStats>;
  } {
    return {
      is_running: this.syncInterval !== null,
      is_syncing: this.isSyncing,
      sync_interval_ms: this.syncIntervalMs,
      cache_status: sqliteCache.getSyncStatus(),
      cache_stats: sqliteCache.getStats()
    };
  }
}

// Singleton instance
export const syncService = new SyncService();

// Auto-start on module load (can be disabled if needed)
if (typeof process !== 'undefined') {
  syncService.start();
}

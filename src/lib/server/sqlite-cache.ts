/**
 * SQLite Cache Service for Zii Wallet
 *
 * High-performance local cache layer that provides sub-100ms query times
 * Synchronized with ZeiCoin node in the background
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface CachedBalance {
  address: string;
  balance: bigint;
  nonce: bigint;
  tx_count: number;
  total_received: bigint;
  total_sent: bigint;
  first_seen_block?: number;
  last_active_block?: number;
  updated_at: number;
}

export interface CachedTransaction {
  hash: string;
  block_height: number;
  block_hash: string;
  position: number;
  sender: string;
  recipient: string;
  amount: bigint;
  fee: bigint;
  nonce: bigint;
  timestamp: number;
  status: string;
  message?: string;
  category?: string;
  reference_id?: string;
  tags?: string[];
  created_at: number;
}

export interface CachedWallet {
  name: string;
  address: string;
  label?: string;
  created_at: number;
  updated_at: number;
}

export interface SyncStatus {
  last_sync_timestamp: number;
  last_sync_block: number;
  cache_age_ms: number;
  is_stale: boolean;
}

class SQLiteCache {
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private readonly staleThreshold = 30000; // 30 seconds

  constructor(dbPath?: string) {
    // Default to user data directory
    this.dbPath = dbPath || join(process.cwd(), 'data', 'wallet-cache.db');
  }

  /**
   * Initialize database connection and schema
   */
  init(): void {
    if (this.db) return; // Already initialized

    try {
      // Ensure data directory exists BEFORE opening database
      const dbDir = dirname(this.dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
        console.log(`[SQLite Cache] Created directory: ${dbDir}`);
      }

      // Open database with optimizations
      this.db = new Database(this.dbPath);

      // Apply schema
      const schemaPath = join(process.cwd(), 'src', 'lib', 'server', 'sqlite-schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);

      console.log(`[SQLite Cache] Initialized at ${this.dbPath}`);
    } catch (error) {
      console.error('[SQLite Cache] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get database instance (lazy initialization)
   */
  private getDb(): Database.Database {
    if (!this.db) {
      this.init();
    }
    return this.db!;
  }

  // ========================================================================
  // WALLET OPERATIONS
  // ========================================================================

  /**
   * Get wallet by name (< 1ms)
   */
  getWallet(name: string): CachedWallet | null {
    const stmt = this.getDb().prepare('SELECT * FROM wallets WHERE name = ?');
    const row = stmt.get(name) as any;

    if (!row) return null;

    return {
      name: row.name,
      address: row.address,
      label: row.label,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Get wallet by address (< 1ms)
   */
  getWalletByAddress(address: string): CachedWallet | null {
    const stmt = this.getDb().prepare('SELECT * FROM wallets WHERE address = ?');
    const row = stmt.get(address) as any;

    if (!row) return null;

    return {
      name: row.name,
      address: row.address,
      label: row.label,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Upsert wallet (cache registration)
   */
  upsertWallet(wallet: Omit<CachedWallet, 'created_at' | 'updated_at'>): void {
    const now = Date.now();
    const stmt = this.getDb().prepare(`
      INSERT INTO wallets (name, address, label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        address = excluded.address,
        label = excluded.label,
        updated_at = excluded.updated_at
    `);

    stmt.run(wallet.name, wallet.address, wallet.label || null, now, now);
  }

  // ========================================================================
  // BALANCE OPERATIONS (< 1ms queries)
  // ========================================================================

  /**
   * Get cached balance for address (< 1ms)
   */
  getBalance(address: string): CachedBalance | null {
    const stmt = this.getDb().prepare('SELECT * FROM balances WHERE address = ?');
    const row = stmt.get(address) as any;

    if (!row) return null;

    return {
      address: row.address,
      balance: BigInt(row.balance),
      nonce: BigInt(row.nonce),
      tx_count: row.tx_count,
      total_received: BigInt(row.total_received),
      total_sent: BigInt(row.total_sent),
      first_seen_block: row.first_seen_block,
      last_active_block: row.last_active_block,
      updated_at: row.updated_at
    };
  }

  /**
   * Update balance cache
   */
  updateBalance(balance: Omit<CachedBalance, 'updated_at'>): void {
    const now = Date.now();
    const stmt = this.getDb().prepare(`
      INSERT INTO balances (
        address, balance, nonce, tx_count, total_received, total_sent,
        first_seen_block, last_active_block, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        balance = excluded.balance,
        nonce = excluded.nonce,
        tx_count = excluded.tx_count,
        total_received = excluded.total_received,
        total_sent = excluded.total_sent,
        last_active_block = excluded.last_active_block,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      balance.address,
      balance.balance.toString(),
      balance.nonce.toString(),
      balance.tx_count,
      balance.total_received.toString(),
      balance.total_sent.toString(),
      balance.first_seen_block || null,
      balance.last_active_block || null,
      now
    );
  }

  // ========================================================================
  // TRANSACTION OPERATIONS
  // ========================================================================

  /**
   * Get recent transactions for address (< 10ms for 50 txs)
   */
  getTransactions(address: string, limit: number = 50, offset: number = 0): CachedTransaction[] {
    const stmt = this.getDb().prepare(`
      SELECT * FROM transactions
      WHERE sender = ? OR recipient = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(address, address, limit, offset) as any[];

    return rows.map(row => this.rowToTransaction(row));
  }

  /**
   * Get transaction by hash (< 1ms)
   */
  getTransaction(hash: string): CachedTransaction | null {
    const stmt = this.getDb().prepare('SELECT * FROM transactions WHERE hash = ?');
    const row = stmt.get(hash) as any;

    if (!row) return null;

    return this.rowToTransaction(row);
  }

  /**
   * Search transactions by message (< 50ms full-text search)
   */
  searchTransactions(address: string, searchTerm: string, limit: number = 50): CachedTransaction[] {
    const stmt = this.getDb().prepare(`
      SELECT * FROM transactions
      WHERE (sender = ? OR recipient = ?)
        AND (message LIKE ? OR category LIKE ? OR reference_id LIKE ?)
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const pattern = `%${searchTerm}%`;
    const rows = stmt.all(address, address, pattern, pattern, pattern, limit) as any[];

    return rows.map(row => this.rowToTransaction(row));
  }

  /**
   * Filter transactions by category (< 5ms)
   */
  getTransactionsByCategory(address: string, category: string, limit: number = 50): CachedTransaction[] {
    const stmt = this.getDb().prepare(`
      SELECT * FROM transactions
      WHERE (sender = ? OR recipient = ?)
        AND category = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(address, address, category, limit) as any[];

    return rows.map(row => this.rowToTransaction(row));
  }

  /**
   * Batch insert/update transactions
   */
  upsertTransactions(transactions: Omit<CachedTransaction, 'created_at'>[]): void {
    const now = Date.now();
    const stmt = this.getDb().prepare(`
      INSERT INTO transactions (
        hash, block_height, block_hash, position, sender, recipient,
        amount, fee, nonce, timestamp, status, message, category,
        reference_id, tags, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hash) DO UPDATE SET
        status = excluded.status,
        message = excluded.message,
        category = excluded.category,
        reference_id = excluded.reference_id,
        tags = excluded.tags
    `);

    const insertMany = this.getDb().transaction((txs: typeof transactions) => {
      for (const tx of txs) {
        stmt.run(
          tx.hash,
          tx.block_height,
          tx.block_hash,
          tx.position,
          tx.sender,
          tx.recipient,
          tx.amount.toString(),
          tx.fee.toString(),
          tx.nonce.toString(),
          tx.timestamp,
          tx.status,
          tx.message || null,
          tx.category || null,
          tx.reference_id || null,
          tx.tags ? JSON.stringify(tx.tags) : null,
          now
        );
      }
    });

    insertMany(transactions);
  }

  // ========================================================================
  // SYNC STATE OPERATIONS
  // ========================================================================

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    const stmt = this.getDb().prepare('SELECT key, value FROM sync_state WHERE key IN (?, ?)');
    const rows = stmt.all('last_sync_timestamp', 'last_sync_block') as any[];

    const state: any = {};
    for (const row of rows) {
      state[row.key] = parseInt(row.value);
    }

    const last_sync_timestamp = state.last_sync_timestamp || 0;
    const cache_age_ms = Date.now() - last_sync_timestamp;

    return {
      last_sync_timestamp,
      last_sync_block: state.last_sync_block || 0,
      cache_age_ms,
      is_stale: cache_age_ms > this.staleThreshold
    };
  }

  /**
   * Update sync state
   */
  updateSyncState(lastBlock: number): void {
    const now = Date.now();
    const stmt = this.getDb().prepare(`
      INSERT INTO sync_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    stmt.run('last_sync_timestamp', now.toString(), now);
    stmt.run('last_sync_block', lastBlock.toString(), now);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    wallet_count: number;
    balance_count: number;
    transaction_count: number;
    cache_size_mb: number;
  } {
    const stats = this.getDb().prepare(`
      SELECT
        (SELECT COUNT(*) FROM wallets) as wallet_count,
        (SELECT COUNT(*) FROM balances) as balance_count,
        (SELECT COUNT(*) FROM transactions) as transaction_count
    `).get() as any;

    // Get database file size
    const dbSizePage = this.getDb().prepare('PRAGMA page_count').get() as any;
    const pageSizeBytes = (this.getDb().prepare('PRAGMA page_size').get() as any).page_size;
    const cache_size_mb = (dbSizePage.page_count * pageSizeBytes) / (1024 * 1024);

    return {
      wallet_count: stats.wallet_count,
      balance_count: stats.balance_count,
      transaction_count: stats.transaction_count,
      cache_size_mb: parseFloat(cache_size_mb.toFixed(2))
    };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private rowToTransaction(row: any): CachedTransaction {
    return {
      hash: row.hash,
      block_height: row.block_height,
      block_hash: row.block_hash,
      position: row.position,
      sender: row.sender,
      recipient: row.recipient,
      amount: BigInt(row.amount),
      fee: BigInt(row.fee),
      nonce: BigInt(row.nonce),
      timestamp: row.timestamp,
      status: row.status,
      message: row.message,
      category: row.category,
      reference_id: row.reference_id,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      created_at: row.created_at
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
export const sqliteCache = new SQLiteCache();

// Initialize on module load
sqliteCache.init();

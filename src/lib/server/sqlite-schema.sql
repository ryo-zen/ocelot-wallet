-- SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
-- SPDX-License-Identifier: GPL-3.0-only

-- Ocelot Wallet SQLite Cache Schema
-- Optimized for millisecond-level query performance
-- This is a local cache layer synchronized with the ZeiCoin node

-- ============================================================================
-- WALLETS TABLE
-- Fast wallet metadata lookups
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallets (
    name TEXT PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    label TEXT,
    created_at INTEGER NOT NULL,  -- Unix timestamp (ms)
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);

-- ============================================================================
-- BALANCES TABLE
-- Lightning-fast balance queries (< 1ms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS balances (
    address TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,  -- Amount in smallest unit (10^8)
    nonce INTEGER NOT NULL DEFAULT 0,
    tx_count INTEGER NOT NULL DEFAULT 0,
    total_received INTEGER NOT NULL DEFAULT 0,
    total_sent INTEGER NOT NULL DEFAULT 0,
    first_seen_block INTEGER,
    last_active_block INTEGER,
    updated_at INTEGER NOT NULL  -- Unix timestamp (ms)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_balances_updated ON balances(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_balances_balance ON balances(balance DESC);

-- ============================================================================
-- TRANSACTIONS TABLE
-- Fast transaction history with full-text search
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    hash TEXT PRIMARY KEY,
    block_height INTEGER NOT NULL,
    block_hash TEXT NOT NULL,
    position INTEGER NOT NULL,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    amount INTEGER NOT NULL,
    fee INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,  -- Unix timestamp (ms)
    status TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed, pending, failed

    -- L2 Enhancement fields
    message TEXT,
    category TEXT,
    reference_id TEXT,
    tags TEXT,  -- JSON array as string

    created_at INTEGER NOT NULL
) STRICT;

-- Performance indexes for sub-millisecond queries
CREATE INDEX IF NOT EXISTS idx_tx_sender_time ON transactions(sender, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_recipient_time ON transactions(recipient, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_height, position);
CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);

-- Composite index for fast "my transactions" queries
CREATE INDEX IF NOT EXISTS idx_tx_address_composite ON transactions(sender, recipient, timestamp DESC);

-- ============================================================================
-- SYNC STATE TABLE
-- Track synchronization with blockchain node
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

-- Initialize sync state
INSERT OR IGNORE INTO sync_state (key, value, updated_at) VALUES
    ('last_sync_timestamp', '0', 0),
    ('last_sync_block', '0', 0),
    ('node_url', 'http://127.0.0.1:8081', 0),
    ('cache_version', '1.0.0', 0);

-- ============================================================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- Increase cache size to 64MB for faster queries
PRAGMA cache_size = -64000;

-- Use memory for temp storage
PRAGMA temp_store = MEMORY;

-- Optimize for speed over safety (acceptable for cache)
PRAGMA synchronous = NORMAL;

-- Enable memory-mapped I/O for faster reads
PRAGMA mmap_size = 268435456;  -- 256MB

-- Analyze tables for query optimization
PRAGMA optimize;

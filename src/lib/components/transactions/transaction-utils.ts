// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

/**
 * Transaction Utility Functions
 *
 * Shared utilities for formatting and processing transaction data
 */

export function formatAmount(amount: number): string {
	return (amount / 100000000).toFixed(8);
}

export function formatDate(timestamp?: string | number): string {
	if (!timestamp) return 'Unknown Time';

	try {
		let date: Date;

		// Handle different timestamp formats
		if (typeof timestamp === 'number') {
			// Handle PostgreSQL microsecond timestamps (e.g., 1756960992000000)
			if (timestamp > 1000000000000000) {
				// Microseconds - divide by 1000 to get milliseconds
				date = new Date(timestamp / 1000);
			} else if (timestamp > 1000000000000) {
				// Milliseconds
				date = new Date(timestamp);
			} else if (timestamp > 1000000000) {
				// Seconds (Unix timestamp) - multiply by 1000
				date = new Date(timestamp * 1000);
			} else {
				// Invalid timestamp
				return 'Unknown Time';
			}
		} else if (typeof timestamp === 'string') {
			// Handle numeric strings
			const numericTimestamp = Number(timestamp);
			if (!isNaN(numericTimestamp)) {
				if (numericTimestamp > 1000000000000000) {
					// Microseconds
					date = new Date(numericTimestamp / 1000);
				} else if (numericTimestamp > 1000000000000) {
					// Milliseconds
					date = new Date(numericTimestamp);
				} else if (numericTimestamp > 1000000000) {
					// Seconds (Unix timestamp)
					date = new Date(numericTimestamp * 1000);
				} else {
					return 'Unknown Time';
				}
			} else {
				// ISO string or other date format
				date = new Date(timestamp);
			}
		} else {
			return 'Unknown Time';
		}

		// Check if the date is valid
		if (isNaN(date.getTime())) {
			return 'Invalid Date';
		}

		return date.toLocaleString('en-GB', {
			timeZone: 'UTC',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}) + ' UTC';
	} catch (error) {
		return 'Invalid Date';
	}
}

export function getStatusBadgeClass(status?: string): string {
	switch (status?.toLowerCase()) {
		case 'confirmed':
			return 'bg-transparent text-foreground border-primary';
		case 'pending':
			return 'bg-yellow-100 text-yellow-800 border-yellow-200';
		case 'failed':
			return 'bg-red-100 text-red-800 border-red-200';
		case 'draft':
			return 'bg-gray-100 text-gray-800 border-gray-200';
		default:
			return 'bg-transparent text-foreground border-primary';
	}
}

export interface Transaction {
	id?: string;
	hash?: string;
	tx_hash?: string;
	block_height?: number;
	amount: number;
	fee?: number;
	recipient: string;
	sender?: string;
	status: 'confirmed' | 'pending' | 'failed' | 'draft';
	timestamp?: string | number;
	created_at?: string | number;
	message?: string | null;
	category?: string | null;
	confirmations?: number;
}

export function filterTransactions(
	transactions: Transaction[],
	statusFilter: string[],
	messageSearch: string
): Transaction[] {
	let filtered = transactions;

	// Apply status filter
	if (statusFilter.length > 0) {
		filtered = filtered.filter(tx =>
			statusFilter.includes((tx.status || 'confirmed').toLowerCase())
		);
	}

	// Apply message search
	if (messageSearch) {
		filtered = filtered.filter(tx =>
			tx.message?.toLowerCase().includes(messageSearch.toLowerCase()) || false
		);
	}

	// Sort by block height (newest first)
	return filtered.sort((a, b) => (b.block_height || 0) - (a.block_height || 0));
}

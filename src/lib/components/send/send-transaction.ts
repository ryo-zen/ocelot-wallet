/**
 * Send Transaction Logic - Tauri Version
 *
 * Simplified transaction flow using Tauri:
 * 1. Validate transaction data
 * 2. Call Tauri sendTransaction (handles signing + broadcast)
 * 3. Optionally save L2 enhancements (messages, categories)
 */

import { tauriWalletAPI } from '$lib/services/tauri-wallet-api';
import { getServerConfig } from '$lib/config/server-config';
import { serverConfigStore } from '$lib/stores/server-config';

export interface TransactionData {
	recipient: string;
	amount: string;
	message?: string;
	category?: string;
	isPrivate?: boolean;
}

export interface TransactionResult {
	success: boolean;
	txHash?: string;
	error?: string;
}

export async function sendTransaction(
	credentials: { wallet: string; password: string },
	data: TransactionData
): Promise<TransactionResult> {
	try {
		// Convert amount to base units (1 ZEI = 100,000,000 base units, like Bitcoin)
		const amountInBaseUnits = Math.floor(parseFloat(data.amount) * 100_000_000);

		// Get RPC URL from server config
		const rpcUrl = serverConfigStore.getCurrentRpcUrl();

		// Send transaction via Tauri (handles everything: unlock, sign, broadcast)
		const response = await tauriWalletAPI.sendTransaction(
			credentials.wallet,
			credentials.password,
			data.recipient.trim(),
			amountInBaseUnits,
			rpcUrl
		);

		if (tauriWalletAPI.isSuccess(response)) {
			const result = tauriWalletAPI.unwrap(response);

			// Optional: Save L2 enhancements (messages, categories, tags)
			if (data.message || data.category) {
				// Note: We don't have sender address here anymore
				// L2 enhancements are optional and non-blocking
				// If this fails, transaction still succeeded
				try {
					await saveL2Enhancements({
						sender: '', // Could get from auth store if needed
						recipient: data.recipient.trim(),
						message: data.message?.trim() || null,
						category: data.category || null,
						isPrivate: data.isPrivate || false,
						txHash: result.transaction_hash
					});
				} catch (l2Error) {
					console.warn('L2 enhancement failed (transaction still sent):', l2Error);
				}
			}

			return {
				success: true,
				txHash: result.transaction_hash
			};
		} else {
			return {
				success: false,
				error: response.error || 'Transaction failed'
			};
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

async function saveL2Enhancements(data: {
	sender: string;
	recipient: string;
	message: string | null;
	category: string | null;
	isPrivate: boolean;
	txHash: string;
}): Promise<void> {
	const serverConfig = getServerConfig();
	const response = await fetch(`${serverConfig.primary_url}/api/l2/enhancements`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sender: data.sender,
			recipient: data.recipient,
			message: data.message,
			category: data.category,
			is_private: data.isPrivate,
			tx_hash: data.txHash
		})
	});

	if (response.ok) {
		const result = await response.json();
		// Mark as pending
		await fetch(`${serverConfig.primary_url}/api/l2/enhancements/${result.temp_id}/pending`, {
			method: 'PUT'
		});
	}
}

export function validateTransaction(
	recipient: string,
	amount: string,
	currentBalance: string
): { valid: boolean; error?: string } {
	if (!recipient.trim()) {
		return { valid: false, error: 'Recipient address is required' };
	}

	if (!amount || parseFloat(amount) <= 0) {
		return { valid: false, error: 'Valid amount is required' };
	}

	const balance = parseFloat(currentBalance);
	const sendAmount = parseFloat(amount);

	if (sendAmount > balance) {
		return { valid: false, error: 'Insufficient balance' };
	}

	return { valid: true };
}

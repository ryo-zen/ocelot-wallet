/**
 * Send Transaction Logic - Tauri Version
 *
 * Simplified transaction flow using Tauri:
 * 1. Validate transaction data
 * 2. Call Tauri sendTransaction (handles signing + broadcast)
 * 3. Optionally save L2 enhancements (messages, categories)
 */

import { tauriWalletAPI } from '$lib/services/tauri-wallet-api';
import { serverConfigStore } from '$lib/stores/server-config';
import { authStore } from '$lib/stores/auth';
import { get } from 'svelte/store';

export interface TransactionData {
	recipient: string;
	amount: string;
	message?: string;
	category?: string;
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

			// Optional: Save L2 message (non-blocking - transaction already succeeded)
			if (data.message || data.category) {
				const sender = get(authStore).address || '';
				const apiUrl = serverConfigStore.getCurrentServerUrl();
				try {
					await tauriWalletAPI.sendL2Message(
						sender,
						data.recipient.trim(),
						data.message?.trim() || null,
						data.category || null,
						result.transaction_hash,
						apiUrl
					);
				} catch (l2Error) {
					console.warn('L2 message failed (transaction still sent):', l2Error);
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

// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

/**
 * Tauri Wallet API Client
 *
 * TypeScript wrapper for Tauri wallet commands
 * Replaces CLI Bridge HTTP API calls with direct Tauri invocations
 */

import { invoke } from '@tauri-apps/api/core';

// Response types matching Rust structs
export interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateWalletResponse {
  wallet_name: string;
  mnemonic: string;
  first_address: string;
}

export interface RestoreWalletResponse {
  wallet_name: string;
  message: string;
}

export interface ListWalletsResponse {
  wallets: string[];
}

export interface UnlockWalletResponse {
  name: string;
  address: string;
}

export interface BalanceResponse {
  balance: string;
}

export interface SendTransactionResponse {
  transaction_hash: string;
}

export interface WalletInfo {
  name: string;
  address: string;
  mnemonic?: string;
}

export interface TransactionHistoryResponse {
  transactions_json: string;
}

export interface FaucetResult {
  claimed: boolean;
  amount?: string;
  txid?: string;
  error?: string;
  retry_after_seconds?: number;
}

/**
 * Tauri Wallet API Class
 * Provides typed interface to Tauri wallet commands
 */
export class TauriWalletAPI {
  /**
   * Create a new wallet
   * @param name - Wallet name
   * @param password - Wallet password (min 8 characters)
   * @returns Wallet info with mnemonic phrase
   */
  async createWallet(
    name: string,
    password: string
  ): Promise<CommandResponse<CreateWalletResponse>> {
    return await invoke<CommandResponse<CreateWalletResponse>>('create_wallet', {
      name,
      password,
    });
  }

  /**
   * Restore wallet from mnemonic
   * @param name - Wallet name
   * @param mnemonic - 12-word mnemonic phrase
   * @param password - Wallet password (min 8 characters)
   * @returns Restore confirmation
   */
  async restoreWallet(
    name: string,
    mnemonic: string,
    password: string
  ): Promise<CommandResponse<RestoreWalletResponse>> {
    return await invoke<CommandResponse<RestoreWalletResponse>>('restore_wallet', {
      name,
      mnemonic,
      password,
    });
  }

  /**
   * List all wallets
   * @returns Array of wallet names
   */
  async listWallets(): Promise<CommandResponse<ListWalletsResponse>> {
    return await invoke<CommandResponse<ListWalletsResponse>>('list_wallets_command');
  }

  /**
   * Unlock wallet and get address
   * @param name - Wallet name
   * @param password - Wallet password
   * @returns Wallet name and address
   */
  async unlockWallet(
    name: string,
    password: string
  ): Promise<CommandResponse<UnlockWalletResponse>> {
    return await invoke<CommandResponse<UnlockWalletResponse>>('unlock_wallet', {
      name,
      password,
    });
  }

  /**
   * Get wallet address
   * @param name - Wallet name
   * @param password - Wallet password
   * @returns Wallet address
   */
  async getAddress(name: string, password: string): Promise<CommandResponse<string>> {
    return await invoke<CommandResponse<string>>('get_address', {
      name,
      password,
    });
  }

  /**
   * Get balance for address
   * @param address - ZeiCoin address (tzei1...)
   * @param rpcUrl - RPC server URL
   * @returns Balance in smallest unit
   */
  async getBalance(address: string, rpcUrl: string): Promise<CommandResponse<BalanceResponse>> {
    return await invoke<CommandResponse<BalanceResponse>>('get_balance', {
      address,
      rpcUrl,
    });
  }

  /**
   * Send transaction
   * @param walletName - Wallet name
   * @param password - Wallet password
   * @param recipient - Recipient address
   * @param amount - Amount in smallest unit
   * @param rpcUrl - RPC server URL
   * @returns Transaction hash
   */
  async sendTransaction(
    walletName: string,
    password: string,
    recipient: string,
    amount: number,
    rpcUrl: string
  ): Promise<CommandResponse<SendTransactionResponse>> {
    return await invoke<CommandResponse<SendTransactionResponse>>('send_transaction', {
      walletName,
      password,
      recipient,
      amount,
      rpcUrl,
    });
  }

  /**
   * Get wallet info (name and address)
   * @param name - Wallet name
   * @param password - Wallet password
   * @returns Wallet info
   */
  async getWalletInfo(
    name: string,
    password: string
  ): Promise<CommandResponse<WalletInfo>> {
    return await invoke<CommandResponse<WalletInfo>>('get_wallet_info', {
      name,
      password,
    });
  }

  /**
   * Get transaction history for an address
   * @param address - ZeiCoin address (tzei1...)
   * @param limit - Maximum number of transactions to fetch
   * @param offset - Number of transactions to skip
   * @param apiUrl - Transaction API URL
   * @returns Transaction history as JSON string
   */
  async getTransactions(
    address: string,
    limit: number = 50,
    offset: number = 0,
    apiUrl: string
  ): Promise<CommandResponse<TransactionHistoryResponse>> {
    return await invoke<CommandResponse<TransactionHistoryResponse>>('get_transactions', {
      address,
      limit,
      offset,
      apiUrl,
    });
  }

  /**
   * Call the testnet faucet with a game score to receive ZEI
   * @param address - ZeiCoin address (tzei1...)
   * @param score - Game score (capped at 200, payout = min(score,200)/100 ZEI)
   * @param apiUrl - Transaction API URL
   * @returns Faucet result
   */
  async callFaucet(
    address: string,
    score: number,
    apiUrl: string
  ): Promise<CommandResponse<FaucetResult>> {
    return await invoke<CommandResponse<FaucetResult>>('call_faucet', {
      address,
      score,
      apiUrl,
    });
  }

  /**
   * Send an L2 message linked to a transaction (create → pending → confirm)
   * @param sender - Sender address
   * @param recipient - Recipient address
   * @param message - Optional message text
   * @param category - Optional category
   * @param txHash - Transaction hash to link the message to
   * @param apiUrl - Transaction API base URL
   */
  async sendL2Message(
    sender: string,
    recipient: string,
    message: string | null,
    category: string | null,
    txHash: string,
    apiUrl: string
  ): Promise<CommandResponse<null>> {
    return await invoke<CommandResponse<null>>('send_l2_message', {
      sender,
      recipient,
      message,
      category,
      txHash,
      apiUrl,
    });
  }

  /**
   * Helper: Check if response is successful
   * @param response - Command response
   * @returns True if successful
   */
  isSuccess<T>(response: CommandResponse<T>): boolean {
    return response.success && response.data !== undefined;
  }

  /**
   * Helper: Extract data or throw error
   * @param response - Command response
   * @returns Data if successful
   * @throws Error with message if failed
   */
  unwrap<T>(response: CommandResponse<T>): T {
    if (this.isSuccess(response)) {
      return response.data as T;
    }
    throw new Error(response.error || 'Unknown error');
  }
}

// Export singleton instance
export const tauriWalletAPI = new TauriWalletAPI();

// Export for convenience
export default tauriWalletAPI;

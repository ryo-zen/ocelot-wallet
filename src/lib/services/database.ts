// Database service for querying ZeiCoin database dynamically

export interface AccountData {
  address: string;
  balance: bigint;
  nonce: bigint;
  first_seen_block?: number;
  last_active_block?: number;
  last_active_time?: Date;
  tx_count?: number;
  total_received?: bigint;
  total_sent?: bigint;
  updated_at?: Date;
}

export class DatabaseService {
  /**
   * Get wallet address from database mapping
   * @param walletName - The wallet name (alan, alice, bob, etc.)
   * @returns Promise with wallet address
   */
  async getWalletAddress(walletName: string): Promise<string> {
    try {
      const response = await fetch('/api/wallets/addresses', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Wallet address API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get wallet addresses');
      }

      const address = result.walletAddresses[walletName];
      if (!address) {
        throw new Error(`Address not found for wallet: ${walletName}`);
      }

      return address;
    } catch (error) {
      throw new Error(`Failed to get address for ${walletName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get account balance from database using address
   * @param address - The wallet address
   * @returns Promise with account data
   */
  async getAccountBalance(address: string): Promise<AccountData> {
    try {
      const response = await fetch(`/api/accounts/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Account not found: ${address}`);
        }
        throw new Error(`Database API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to query database');
      }

      return data.account;
    } catch (error) {
      throw new Error(`Failed to fetch account data for ${address}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get wallet balance using database-only queries
   * @param walletName - The wallet name (alan, alice, bob, etc.)
   * @returns Promise with balance data
   */
  async getWalletBalance(walletName: string): Promise<{ balance: number; address: string }> {
    try {
      // Get the wallet address from database mapping
      const address = await this.getWalletAddress(walletName);
      
      // Get the account data from database
      const accountData = await this.getAccountBalance(address);
      
      // Convert balance from smallest unit (8 decimal places) to ZEI
      const balanceInZei = Number(accountData.balance) / 100000000; // 10^8
      
      return {
        balance: balanceInZei,
        address: address
      };
    } catch (error) {
      throw new Error(`Failed to fetch balance for ${walletName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all accounts from database
   * @param limit - Maximum number of accounts to return
   * @param offset - Offset for pagination
   * @returns Promise with accounts list
   */
  async getAllAccounts(limit: number = 10, offset: number = 0): Promise<AccountData[]> {
    try {
      const response = await fetch(`/api/accounts?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Database API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to query database');
      }

      return data.accounts.map((account: any) => ({
        address: account.address,
        balance: BigInt(account.balance),
        nonce: BigInt(account.nonce),
        tx_count: account.tx_count,
        last_active_time: account.last_active_time ? new Date(account.last_active_time) : undefined
      }));
    } catch (error) {
      throw new Error(`Failed to fetch accounts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const databaseService = new DatabaseService();
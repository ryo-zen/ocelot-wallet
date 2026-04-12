/**
 * Tests for Tauri Wallet API
 * Uses TDD approach to verify all wallet operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

import { TauriWalletAPI, type CommandResponse } from './tauri-wallet-api';
import { invoke } from '@tauri-apps/api/core';

describe('TauriWalletAPI', () => {
	let api: TauriWalletAPI;
	const mockInvoke = vi.mocked(invoke);

	beforeEach(() => {
		api = new TauriWalletAPI();
		vi.clearAllMocks();
	});

	describe('createWallet', () => {
		it('should create wallet successfully', async () => {
			const mockResponse: CommandResponse<{
				wallet_name: string;
				mnemonic: string;
				first_address: string;
			}> = {
				success: true,
				data: {
					wallet_name: 'test-wallet',
					mnemonic: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
					first_address: 'tzei1test123'
				}
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.createWallet('test-wallet', 'password123');

			expect(mockInvoke).toHaveBeenCalledWith('create_wallet', {
				name: 'test-wallet',
				password: 'password123'
			});
			expect(result.success).toBe(true);
			expect(result.data?.wallet_name).toBe('test-wallet');
			expect(result.data?.mnemonic).toBeTruthy();
			expect(result.data?.first_address).toMatch(/^tzei1/);
		});

		it('should handle wallet creation error', async () => {
			const mockResponse: CommandResponse<never> = {
				success: false,
				error: 'Wallet already exists'
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.createWallet('existing-wallet', 'password123');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Wallet already exists');
		});
	});

	describe('restoreWallet', () => {
		it('should restore wallet from mnemonic successfully', async () => {
			const mockResponse: CommandResponse<{
				wallet_name: string;
				message: string;
			}> = {
				success: true,
				data: {
					wallet_name: 'restored-wallet',
					message: 'Wallet restored successfully'
				}
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const mnemonic = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';
			const result = await api.restoreWallet('restored-wallet', mnemonic, 'password123');

			expect(mockInvoke).toHaveBeenCalledWith('restore_wallet', {
				name: 'restored-wallet',
				mnemonic,
				password: 'password123'
			});
			expect(result.success).toBe(true);
			expect(result.data?.wallet_name).toBe('restored-wallet');
		});

		it('should handle invalid mnemonic error', async () => {
			const mockResponse: CommandResponse<never> = {
				success: false,
				error: 'Invalid mnemonic phrase'
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.restoreWallet('test', 'invalid mnemonic', 'password123');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid mnemonic phrase');
		});
	});

	describe('listWallets', () => {
		it('should list all wallets', async () => {
			const mockResponse: CommandResponse<{ wallets: string[] }> = {
				success: true,
				data: {
					wallets: ['wallet1', 'wallet2', 'wallet3']
				}
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.listWallets();

			expect(mockInvoke).toHaveBeenCalledWith('list_wallets_command');
			expect(result.success).toBe(true);
			expect(result.data?.wallets).toHaveLength(3);
		});

		it('should return empty list when no wallets exist', async () => {
			const mockResponse: CommandResponse<{ wallets: string[] }> = {
				success: true,
				data: {
					wallets: []
				}
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.listWallets();

			expect(result.success).toBe(true);
			expect(result.data?.wallets).toEqual([]);
		});
	});

	describe('unlockWallet', () => {
		it('should unlock wallet with correct password', async () => {
			const mockResponse: CommandResponse<{
				name: string;
				address: string;
			}> = {
				success: true,
				data: {
					name: 'test-wallet',
					address: 'tzei1test123'
				}
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.unlockWallet('test-wallet', 'correct-password');

			expect(mockInvoke).toHaveBeenCalledWith('unlock_wallet', {
				name: 'test-wallet',
				password: 'correct-password'
			});
			expect(result.success).toBe(true);
			expect(result.data?.name).toBe('test-wallet');
			expect(result.data?.address).toMatch(/^tzei1/);
		});

		it('should fail with incorrect password', async () => {
			const mockResponse: CommandResponse<never> = {
				success: false,
				error: 'Invalid password'
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.unlockWallet('test-wallet', 'wrong-password');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid password');
		});
	});

	describe('getBalance', () => {
		it('should get balance for address', async () => {
			const mockResponse: CommandResponse<{ balance: string }> = {
				success: true,
				data: {
					balance: '1000000000'
				}
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.getBalance('tzei1test123', 'http://localhost:8080');

			expect(mockInvoke).toHaveBeenCalledWith('get_balance', {
				address: 'tzei1test123',
				rpcUrl: 'http://localhost:8080'
			});
			expect(result.success).toBe(true);
			expect(result.data?.balance).toBe('1000000000');
		});

		it('should handle network errors gracefully', async () => {
			const mockResponse: CommandResponse<never> = {
				success: false,
				error: 'Failed to fetch balance from API'
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.getBalance('tzei1test123', 'http://localhost:8080');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Failed to fetch balance');
		});
	});

	describe('sendTransaction', () => {
		it('should send transaction successfully', async () => {
			const mockResponse: CommandResponse<{ transaction_hash: string }> = {
				success: true,
				data: {
					transaction_hash: 'hash123456'
				}
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.sendTransaction(
				'test-wallet',
				'password123',
				'tzei1recipient',
				1000000,
				'http://localhost:8080'
			);

			expect(mockInvoke).toHaveBeenCalledWith('send_transaction', {
				walletName: 'test-wallet',
				password: 'password123',
				recipient: 'tzei1recipient',
				amount: 1000000,
				rpcUrl: 'http://localhost:8080'
			});
			expect(result.success).toBe(true);
			expect(result.data?.transaction_hash).toBe('hash123456');
		});

		it('should handle insufficient balance error', async () => {
			const mockResponse: CommandResponse<never> = {
				success: false,
				error: 'Insufficient balance'
			};

			mockInvoke.mockResolvedValue(mockResponse);

			const result = await api.sendTransaction(
				'test-wallet',
				'password123',
				'tzei1recipient',
				9999999999,
				'http://localhost:8080'
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Insufficient balance');
		});
	});

	describe('Helper methods', () => {
		it('isSuccess should return true for successful response', () => {
			const response: CommandResponse<{ data: string }> = {
				success: true,
				data: { data: 'test' }
			};

			expect(api.isSuccess(response)).toBe(true);
		});

		it('isSuccess should return false for failed response', () => {
			const response: CommandResponse<never> = {
				success: false,
				error: 'Error message'
			};

			expect(api.isSuccess(response)).toBe(false);
		});

		it('isSuccess should return false when data is undefined', () => {
			const response: CommandResponse<never> = {
				success: true
			};

			expect(api.isSuccess(response)).toBe(false);
		});

		it('unwrap should return data for successful response', () => {
			const response: CommandResponse<{ value: number }> = {
				success: true,
				data: { value: 42 }
			};

			const result = api.unwrap(response);

			expect(result).toEqual({ value: 42 });
		});

		it('unwrap should throw error for failed response', () => {
			const response: CommandResponse<never> = {
				success: false,
				error: 'Test error'
			};

			expect(() => api.unwrap(response)).toThrow('Test error');
		});

		it('unwrap should throw generic error when no error message provided', () => {
			const response: CommandResponse<never> = {
				success: false
			};

			expect(() => api.unwrap(response)).toThrow('Unknown error');
		});
	});
});

// Wallet configuration - now dynamic, addresses are fetched from CLI Bridge

// Common wallet names for reference (addresses are fetched dynamically)
export const COMMON_WALLET_NAMES = [
  'alan',
  'alice', 
  'bob',
  'miner',
  'charlie'
] as const;

export type WalletName = typeof COMMON_WALLET_NAMES[number] | string;
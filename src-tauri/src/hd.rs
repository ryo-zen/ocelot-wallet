// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

/// HD Wallet Derivation - SLIP-0010 for Ed25519
///
/// Uses SLIP-0010 standard for Ed25519 HD key derivation
/// Path: m/44'/882'/0'/0/{index}
/// Based on: https://github.com/satoshilabs/slips/blob/master/slip-0010.md
use ed25519_dalek::{SigningKey, VerifyingKey};
use hmac::{Hmac, Mac};
use sha2::Sha512;

type HmacSha512 = Hmac<Sha512>;

const ED25519_CURVE: &[u8] = b"ed25519 seed";

/// HD Key for deterministic key generation using SLIP-0010
pub struct HDKey {
    /// Master key bytes
    key: [u8; 32],
    /// Chain code for derivation
    chain_code: [u8; 32],
    /// Current derivation index
    pub index: u32,
}

impl HDKey {
    /// Create HD key from BIP39 seed using SLIP-0010
    pub fn from_seed(seed: &[u8; 64]) -> Result<Self, String> {
        // Derive master key using HMAC-SHA512
        let mut mac = HmacSha512::new_from_slice(ED25519_CURVE)
            .map_err(|e| format!("HMAC init failed: {}", e))?;

        mac.update(seed);
        let result = mac.finalize().into_bytes();

        // Split into key and chain code
        let mut key = [0u8; 32];
        let mut chain_code = [0u8; 32];
        key.copy_from_slice(&result[..32]);
        chain_code.copy_from_slice(&result[32..]);

        Ok(HDKey {
            key,
            chain_code,
            index: 0,
        })
    }

    /// Derive key at BIP44 path index: m/44'/882'/0'/0/{index}
    /// All indices are hardened for Ed25519
    pub fn derive_key_at_index(&self, address_index: u32) -> Result<SigningKey, String> {
        // Start with master key
        let mut key = self.key;
        let mut chain_code = self.chain_code;

        // Derive m/44'
        (key, chain_code) = self.derive_child_from(key, chain_code, 44)?;

        // Derive m/44'/882' (ZeiCoin)
        (key, chain_code) = self.derive_child_from(key, chain_code, 882)?;

        // Derive m/44'/882'/0'
        (key, chain_code) = self.derive_child_from(key, chain_code, 0)?;

        // Derive m/44'/882'/0'/0'
        (key, chain_code) = self.derive_child_from(key, chain_code, 0)?;

        // Finally derive m/44'/882'/0'/0/{address_index}
        (key, _) = self.derive_child_from(key, chain_code, address_index)?;

        // Create Ed25519 signing key
        let signing_key = SigningKey::from_bytes(&key);

        Ok(signing_key)
    }

    /// Helper to derive child from given key and chain code
    fn derive_child_from(
        &self,
        key: [u8; 32],
        chain_code: [u8; 32],
        index: u32,
    ) -> Result<([u8; 32], [u8; 32]), String> {
        // Ed25519 always uses hardened derivation
        let hardened_index = 0x80000000 | index;

        // Data = 0x00 || key || index
        let mut data = Vec::with_capacity(37);
        data.push(0x00);
        data.extend_from_slice(&key);
        data.extend_from_slice(&hardened_index.to_be_bytes());

        // HMAC-SHA512(chain_code, data)
        let mut mac = HmacSha512::new_from_slice(&chain_code)
            .map_err(|e| format!("HMAC init failed: {}", e))?;

        mac.update(&data);
        let result = mac.finalize().into_bytes();

        // Split result
        let mut child_key = [0u8; 32];
        let mut child_chain_code = [0u8; 32];
        child_key.copy_from_slice(&result[..32]);
        child_chain_code.copy_from_slice(&result[32..]);

        Ok((child_key, child_chain_code))
    }

    /// Derive verifying key (public key) at index
    pub fn derive_public_key_at_index(&self, index: u32) -> Result<VerifyingKey, String> {
        let signing_key = self.derive_key_at_index(index)?;
        Ok(signing_key.verifying_key())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bip39::Mnemonic;
    use std::str::FromStr;

    #[test]
    fn test_hd_key_from_seed() {
        // Test with known mnemonic
        let mnemonic_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = Mnemonic::from_str(mnemonic_phrase).unwrap();
        let seed = mnemonic.to_seed("");

        let hd_key = HDKey::from_seed(&seed).unwrap();
        assert_eq!(hd_key.index, 0);
    }

    #[test]
    fn test_derive_multiple_keys() {
        let mnemonic_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = Mnemonic::from_str(mnemonic_phrase).unwrap();
        let seed = mnemonic.to_seed("");

        let hd_key = HDKey::from_seed(&seed).unwrap();

        // Derive keys at different indices
        let key0 = hd_key.derive_key_at_index(0).unwrap();
        let key1 = hd_key.derive_key_at_index(1).unwrap();
        let key2 = hd_key.derive_key_at_index(2).unwrap();

        // Keys should be different
        assert_ne!(key0.to_bytes(), key1.to_bytes());
        assert_ne!(key1.to_bytes(), key2.to_bytes());
        assert_ne!(key0.to_bytes(), key2.to_bytes());
    }

    #[test]
    fn test_deterministic_derivation() {
        let mnemonic_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = Mnemonic::from_str(mnemonic_phrase).unwrap();
        let seed = mnemonic.to_seed("");

        // Create two HD keys from same seed
        let hd_key1 = HDKey::from_seed(&seed).unwrap();
        let hd_key2 = HDKey::from_seed(&seed).unwrap();

        // Derive same index from both
        let key1 = hd_key1.derive_key_at_index(0).unwrap();
        let key2 = hd_key2.derive_key_at_index(0).unwrap();

        // Should be identical
        assert_eq!(key1.to_bytes(), key2.to_bytes());
    }

    #[test]
    fn test_public_key_derivation() {
        let mnemonic_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = Mnemonic::from_str(mnemonic_phrase).unwrap();
        let seed = mnemonic.to_seed("");

        let hd_key = HDKey::from_seed(&seed).unwrap();
        let public_key = hd_key.derive_public_key_at_index(0).unwrap();

        // Public key should be 32 bytes
        assert_eq!(public_key.to_bytes().len(), 32);
    }
}

/// ZeiCoin HD Wallet Implementation with BLAKE3
///
/// Uses BLAKE3 instead of HMAC-SHA512 for Ed25519 key derivation (BIP32/BIP44 path structure).
/// Optimized for performance and consistency with ZeiCoin blockchain cryptography.
/// This implementation MUST match the Zig blockchain code exactly.

use blake3;
use ed25519_dalek::{SigningKey, VerifyingKey};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// HD key with chain code for derivation
/// Matches: zeicoin/src/core/crypto/hd.zig HDKey struct
#[derive(ZeroizeOnDrop)]
pub struct HDKey {
    /// Key material (32 bytes for Ed25519) - automatically zeroized on drop
    pub key: [u8; 32],
    /// Chain code for child derivation - automatically zeroized on drop
    pub chain_code: [u8; 32],
    /// Depth in hierarchy (0 for master)
    pub depth: u8,
    /// Child number (index at this depth)
    pub child_number: u32,
    /// Parent fingerprint (first 4 bytes of parent pubkey hash)
    pub parent_fingerprint: [u8; 4],
}

impl HDKey {
    /// Create master key from seed
    /// Matches: zeicoin/src/core/crypto/hd.zig fromSeed()
    pub fn from_seed(seed: &[u8; 64]) -> Result<Self, String> {
        // Use BLAKE3 with domain separation (lines 61-64)
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"zeicoin-hd-master");
        hasher.update(seed);

        let key_hash = hasher.finalize(); // Returns exactly 32 bytes (lines 66-67)
        let key: [u8; 32] = *key_hash.as_bytes();

        // Second round for chain code (lines 70-73)
        let mut hasher2 = blake3::Hasher::new();
        hasher2.update(b"zeicoin-hd-chain");
        hasher2.update(seed);

        let chain_code_hash = hasher2.finalize(); // Returns exactly 32 bytes
        let chain_code: [u8; 32] = *chain_code_hash.as_bytes();

        Ok(HDKey {
            key,
            chain_code,
            depth: 0,
            child_number: 0,
            parent_fingerprint: [0u8; 4],
        })
    }

    /// Derive child key at index
    /// Matches: zeicoin/src/core/crypto/hd.zig deriveChild()
    pub fn derive_child(&self, index: u32) -> Result<HDKey, String> {
        if self.depth >= 255 {
            return Err("Maximum depth exceeded".to_string());
        }

        // Prepare data for derivation (lines 96-99)
        let mut data = [0u8; 37];
        data[0] = 0x00; // Hardened derivation marker
        data[1..33].copy_from_slice(&self.key);
        data[33..37].copy_from_slice(&index.to_be_bytes());

        // Derive using BLAKE3 (lines 102-107)
        let mut hasher = blake3::Hasher::new();
        hasher.update(&self.chain_code);
        hasher.update(&data);

        let new_key_hash = hasher.finalize();
        let new_key: [u8; 32] = *new_key_hash.as_bytes();

        // Second round for new chain code (lines 110-114)
        let mut hasher2 = blake3::Hasher::new();
        hasher2.update(b"zeicoin-hd-child-chain");
        hasher2.update(&self.chain_code);
        hasher2.update(&data);

        let new_chain_code_hash = hasher2.finalize();
        let new_chain_code: [u8; 32] = *new_chain_code_hash.as_bytes();

        // Calculate parent fingerprint (lines 117-121)
        let parent_pubkey = self.get_public_key()?;
        let mut fp_hasher = blake3::Hasher::new();
        fp_hasher.update(&parent_pubkey);
        let fp_hash = fp_hasher.finalize();

        let mut parent_fingerprint = [0u8; 4];
        parent_fingerprint.copy_from_slice(&fp_hash.as_bytes()[0..4]);

        Ok(HDKey {
            key: new_key,
            chain_code: new_chain_code,
            depth: self.depth + 1,
            child_number: index,
            parent_fingerprint,
        })
    }

    /// Get Ed25519 public key from this HD key
    /// Matches: zeicoin/src/core/crypto/hd.zig getPublicKey()
    pub fn get_public_key(&self) -> Result<[u8; 32], String> {
        // CRITICAL: In ed25519-dalek v2, SigningKey::from_bytes() expects a 32-byte SEED
        // and does the SHA-512 hashing internally (matching RFC 8032).
        // This matches Zig's Ed25519.KeyPair.generateDeterministic(seed)
        //
        // The HD key material IS our Ed25519 seed - use it directly!
        let signing_key = SigningKey::from_bytes(&self.key);
        let verifying_key = signing_key.verifying_key();
        Ok(verifying_key.to_bytes())
    }

    /// Get signing key for transactions
    pub fn get_signing_key(&self) -> Result<SigningKey, String> {
        // CRITICAL: In ed25519-dalek v2, SigningKey::from_bytes() expects a 32-byte SEED
        // and does the SHA-512 hashing internally (matching RFC 8032).
        // This matches Zig's Ed25519.KeyPair.generateDeterministic(seed)
        //
        // The HD key material IS our Ed25519 seed - use it directly!
        Ok(SigningKey::from_bytes(&self.key))
    }

    /// Derive public key at a specific index (BIP44 path)
    /// Matches the wallet's HD derivation path: m/44'/882'/0'/0/{index}
    pub fn derive_public_key_at_index(&self, index: u32) -> Result<VerifyingKey, String> {
        // For BIP44: m/44'/882'/0'/0/{index}
        // Purpose: 44' (hardened)
        let purpose = self.derive_child(0x80000000 | 44)?;
        // Coin type: 882' (hardened) - ZeiCoin (both testnet and mainnet)
        let coin_type = purpose.derive_child(0x80000000 | 882)?;
        // Account: 0' (hardened)
        let account = coin_type.derive_child(0x80000000 | 0)?;
        // Change: 0 (external chain)
        let change = account.derive_child(0)?;
        // Address index
        let address_key = change.derive_child(index)?;

        let signing_key = address_key.get_signing_key()?;
        Ok(signing_key.verifying_key())
    }

    /// Derive key at a specific index (for signing)
    pub fn derive_key_at_index(&self, index: u32) -> Result<SigningKey, String> {
        // For BIP44: m/44'/882'/0'/0/{index}
        let purpose = self.derive_child(0x80000000 | 44)?;
        let coin_type = purpose.derive_child(0x80000000 | 882)?;
        let account = coin_type.derive_child(0x80000000 | 0)?;
        let change = account.derive_child(0)?;
        let address_key = change.derive_child(index)?;

        address_key.get_signing_key()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_master_key_generation() {
        let seed = [0x42u8; 64];
        let master = HDKey::from_seed(&seed).unwrap();

        assert_eq!(master.depth, 0);
        assert_eq!(master.child_number, 0);
    }

    #[test]
    fn test_child_derivation() {
        let seed = [0x42u8; 64];
        let master = HDKey::from_seed(&seed).unwrap();

        let child0 = master.derive_child(0).unwrap();
        let child1 = master.derive_child(1).unwrap();

        // Different children should have different keys
        assert_ne!(child0.key, child1.key);
        assert_eq!(child0.depth, 1);
        assert_eq!(child1.depth, 1);
    }

    #[test]
    fn test_public_key_derivation() {
        let seed = [0x42u8; 64];
        let master = HDKey::from_seed(&seed).unwrap();

        let pubkey0 = master.derive_public_key_at_index(0).unwrap();
        let pubkey1 = master.derive_public_key_at_index(1).unwrap();

        // Different indices should produce different public keys
        assert_ne!(pubkey0.to_bytes(), pubkey1.to_bytes());
    }
}

// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

/// Wallet module - Secure HD wallet matching Zig implementation
///
/// Security features:
/// - Encrypts MNEMONIC (not seed) matching Zig
/// - BIP44 HD derivation: m/44'/882'/0'/0/{index}
/// - Bech32 address encoding
/// - Argon2id KDF with same params as Zig
/// - AES-256-GCM encryption
/// - Secure memory clearing
use crate::address::encode_address;
use crate::crypto::{decrypt, derive_key, encrypt, generate_nonce, generate_salt};
use crate::zeicoin_bip39; // Use ZeiCoin custom BIP39 (BLAKE3-based)
use crate::zeicoin_hd::HDKey; // Use ZeiCoin custom HD derivation
use ed25519_dalek::SigningKey;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Encrypted wallet file structure (JSON format)
/// Matches Zig conceptually but uses JSON instead of binary
#[derive(Serialize, Deserialize)]
pub struct WalletFile {
    /// Encrypted mnemonic phrase (NOT seed)
    pub encrypted_mnemonic: Vec<u8>,
    /// Salt for Argon2 key derivation
    pub salt: Vec<u8>,
    /// Nonce for AES-GCM encryption
    pub nonce: Vec<u8>,
    /// File format version
    pub version: u32,
}

impl WalletFile {
    /// Current wallet file version
    pub const VERSION: u32 = 1;
}

/// Wallet information returned to frontend
#[derive(Serialize, Clone)]
pub struct WalletInfo {
    pub name: String,
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mnemonic: Option<String>,
}

/// In-memory wallet with HD key derivation
pub struct Wallet {
    /// Mnemonic phrase (only in memory when unlocked)
    pub mnemonic: String,
    /// HD key for derivation
    pub hd_key: HDKey,
    /// Wallet name
    pub name: String,
    /// Current address index (for multi-address support)
    pub index: u32,
}

impl Wallet {
    /// Create a new wallet with 12-word BIP39 mnemonic
    /// Matches Zig: wallet.createNew(12)
    pub fn create(name: &str, password: &str) -> Result<(Self, String), String> {
        if name.is_empty() {
            return Err("Wallet name cannot be empty".to_string());
        }

        if password.len() < 8 {
            return Err("Password must be at least 8 characters".to_string());
        }

        // Generate 12-word mnemonic using ZeiCoin's BLAKE3-based generation
        let mnemonic_phrase = zeicoin_bip39::generate_mnemonic()?;

        // Derive seed from mnemonic using ZeiCoin's BLAKE3-based KDF (no passphrase, matching Zig)
        let seed = zeicoin_bip39::mnemonic_to_seed(&mnemonic_phrase, None);

        // Create HD key from seed using ZeiCoin's BLAKE3-based derivation
        let hd_key =
            HDKey::from_seed(&seed).map_err(|e| format!("Failed to create HD key: {}", e))?;

        let wallet = Wallet {
            mnemonic: mnemonic_phrase.clone(),
            hd_key,
            name: name.to_string(),
            index: 0,
        };

        // Save encrypted wallet file
        wallet.save(password)?;

        Ok((wallet, mnemonic_phrase))
    }

    /// Restore wallet from BIP39 mnemonic
    /// Matches Zig: wallet.fromMnemonic(mnemonic, null)
    pub fn restore(name: &str, mnemonic_phrase: &str, password: &str) -> Result<Self, String> {
        if name.is_empty() {
            return Err("Wallet name cannot be empty".to_string());
        }

        if password.len() < 8 {
            return Err("Password must be at least 8 characters".to_string());
        }

        // Validate mnemonic using ZeiCoin's BLAKE3 checksum
        zeicoin_bip39::validate_mnemonic(mnemonic_phrase)?;

        // Derive seed from mnemonic using ZeiCoin's BLAKE3-based KDF (no passphrase)
        let seed = zeicoin_bip39::mnemonic_to_seed(mnemonic_phrase, None);

        // Create HD key from seed using ZeiCoin's BLAKE3-based derivation
        let hd_key =
            HDKey::from_seed(&seed).map_err(|e| format!("Failed to create HD key: {}", e))?;

        let wallet = Wallet {
            mnemonic: mnemonic_phrase.to_string(),
            hd_key,
            name: name.to_string(),
            index: 0,
        };

        // Save encrypted wallet file
        wallet.save(password)?;

        Ok(wallet)
    }

    /// Load existing wallet from encrypted file
    /// Matches Zig: wallet.loadFromFile(path, password)
    pub fn load(name: &str, password: &str) -> Result<Self, String> {
        if name.is_empty() {
            return Err("Wallet name cannot be empty".to_string());
        }

        let path = Self::get_wallet_path(name);

        if !path.exists() {
            return Err(format!("Wallet '{}' not found", name));
        }

        // Read encrypted file
        let data = fs::read(&path).map_err(|e| format!("Failed to read wallet: {}", e))?;

        let wallet_file: WalletFile =
            serde_json::from_slice(&data).map_err(|e| format!("Invalid wallet file: {}", e))?;

        // Verify version
        if wallet_file.version != WalletFile::VERSION {
            return Err(format!(
                "Unsupported wallet version: {}",
                wallet_file.version
            ));
        }

        // Derive key from password (using Zig-matching Argon2 params)
        let key = derive_key(password, &wallet_file.salt)?;

        // Decrypt mnemonic (NOT seed - this is critical difference from old implementation)
        let mnemonic_bytes = decrypt(
            &wallet_file.encrypted_mnemonic,
            &key,
            wallet_file.nonce.as_slice().try_into().unwrap(),
        )?;

        // Convert to string
        let mnemonic_phrase = String::from_utf8(mnemonic_bytes)
            .map_err(|_| "Invalid mnemonic encoding".to_string())?;

        // Validate mnemonic using ZeiCoin's BLAKE3 checksum
        zeicoin_bip39::validate_mnemonic(&mnemonic_phrase)
            .map_err(|e| format!("Corrupted wallet file: {}", e))?;

        // Derive seed using ZeiCoin's BLAKE3-based KDF
        let seed = zeicoin_bip39::mnemonic_to_seed(&mnemonic_phrase, None);

        // Create HD key using ZeiCoin's BLAKE3-based derivation
        let hd_key =
            HDKey::from_seed(&seed).map_err(|e| format!("Failed to create HD key: {}", e))?;

        Ok(Wallet {
            mnemonic: mnemonic_phrase,
            hd_key,
            name: name.to_string(),
            index: 0,
        })
    }

    /// Save wallet encrypted with password
    /// SECURITY: Encrypts MNEMONIC not seed (matches Zig)
    fn save(&self, password: &str) -> Result<(), String> {
        let path = Self::get_wallet_path(&self.name);

        // Create wallet directory if it doesn't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create wallet directory: {}", e))?;
        }

        // Generate salt and nonce
        let salt = generate_salt();
        let nonce = generate_nonce();

        // Derive encryption key from password (Argon2id with Zig params)
        let key = derive_key(password, &salt)?;

        // CRITICAL: Encrypt the MNEMONIC PHRASE (not the seed)
        // This matches Zig implementation and allows recovery from mnemonic
        let encrypted_mnemonic = encrypt(self.mnemonic.as_bytes(), &key, &nonce)?;

        // Create wallet file structure
        let wallet_file = WalletFile {
            encrypted_mnemonic,
            salt: salt.to_vec(),
            nonce: nonce.to_vec(),
            version: WalletFile::VERSION,
        };

        // Serialize to JSON (prettier than binary for debugging)
        let json = serde_json::to_string_pretty(&wallet_file)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        // Write to file with .wallet extension
        fs::write(&path, json).map_err(|e| format!("Failed to write wallet: {}", e))?;

        Ok(())
    }

    /// Get wallet address at current index
    /// Uses BIP44 derivation: m/44'/882'/0'/0/{index}
    /// Encodes as Bech32 with "tzei" prefix
    pub fn get_address(&self) -> String {
        self.get_address_at_index(self.index)
    }

    /// Get wallet address at specific index
    pub fn get_address_at_index(&self, index: u32) -> String {
        // Derive public key at index using BIP44
        let public_key = self
            .hd_key
            .derive_public_key_at_index(index)
            .expect("Failed to derive public key");

        // Encode as Bech32 address
        encode_address(&public_key).expect("Failed to encode address")
    }

    /// Get signing key at current index
    pub fn get_signing_key(&self) -> Result<SigningKey, String> {
        self.hd_key.derive_key_at_index(self.index)
    }

    /// Get public key at current index
    pub fn get_public_key(&self) -> [u8; 32] {
        let verifying_key = self
            .hd_key
            .derive_public_key_at_index(self.index)
            .expect("Failed to derive public key");
        verifying_key.to_bytes()
    }

    /// Sign a transaction hash at current index
    pub fn sign(&self, tx_hash: &[u8; 32]) -> Result<Vec<u8>, String> {
        let signing_key = self.get_signing_key()?;
        use ed25519_dalek::Signer;
        let signature = signing_key.sign(tx_hash);
        Ok(signature.to_bytes().to_vec())
    }

    /// Get wallet storage directory
    fn get_wallet_dir() -> PathBuf {
        // Check if we're in test mode (HOME env var set to temp dir)
        if let Ok(home) = std::env::var("HOME") {
            if home.contains("/tmp") || home.contains("\\Temp\\") {
                // Test mode - use temp directory
                return PathBuf::from(home).join(".ocelot-wallet/wallets");
            }
        }

        // Production mode - use OS-standard app data directory
        let app_dir = dirs::data_dir()
            .expect("Failed to get app data directory")
            .join("ocelot-wallet");
        app_dir.join("wallets")
    }

    /// Get path to specific wallet file
    /// Uses .wallet extension (matching Zig)
    fn get_wallet_path(name: &str) -> PathBuf {
        Self::get_wallet_dir().join(format!("{}.wallet", name))
    }
}

/// Secure cleanup on drop
impl Drop for Wallet {
    fn drop(&mut self) {
        // Securely zero out mnemonic in memory
        unsafe {
            let mnemonic_bytes = self.mnemonic.as_bytes_mut();
            for byte in mnemonic_bytes.iter_mut() {
                *byte = 0;
            }
        }
    }
}

/// List all available wallets
/// Matches Zig: wallet list command
pub fn list_wallets() -> Result<Vec<String>, String> {
    let wallet_dir = Wallet::get_wallet_dir();

    if !wallet_dir.exists() {
        return Ok(Vec::new());
    }

    let mut wallets = Vec::new();

    for entry in
        fs::read_dir(&wallet_dir).map_err(|e| format!("Failed to read wallet directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Look for .wallet files (matching Zig)
        if path.extension().and_then(|s| s.to_str()) == Some("wallet") {
            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                wallets.push(name.to_string());
            }
        }
    }

    wallets.sort();
    Ok(wallets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_wallet() {
        let temp_dir = TempDir::new().unwrap();
        let _home_guard = crate::set_test_home(temp_dir.path());

        let result = Wallet::create("test_wallet", "password123");
        assert!(result.is_ok());

        let (wallet, mnemonic) = result.unwrap();
        assert_eq!(wallet.name, "test_wallet");

        // Mnemonic should be 12 words
        assert_eq!(mnemonic.split_whitespace().count(), 12);

        // Address should be Bech32 format
        let address = wallet.get_address();
        assert!(address.starts_with("tzei1"));
    }

    #[test]
    fn test_create_wallet_weak_password() {
        let result = Wallet::create("test_wallet", "weak");
        match result {
            Err(msg) => assert!(msg.contains("at least 8 characters")),
            Ok(_) => panic!("Should have failed with weak password"),
        }
    }

    #[test]
    fn test_restore_wallet() {
        let temp_dir = TempDir::new().unwrap();
        let _home_guard = crate::set_test_home(temp_dir.path());

        // Generate a valid ZeiCoin mnemonic (with BLAKE3 checksum)
        let mnemonic = zeicoin_bip39::generate_mnemonic().unwrap();

        let result = Wallet::restore("restored_wallet", &mnemonic, "password123");
        assert!(result.is_ok());

        let wallet = result.unwrap();
        assert_eq!(wallet.name, "restored_wallet");
    }

    #[test]
    fn test_load_wallet() {
        let temp_dir = TempDir::new().unwrap();
        let _home_guard = crate::set_test_home(temp_dir.path());

        // Create wallet
        let (wallet, _) = Wallet::create("test_wallet", "password123").unwrap();
        let address1 = wallet.get_address();
        drop(wallet); // Release wallet before loading again

        // Load wallet
        let loaded_wallet = Wallet::load("test_wallet", "password123").unwrap();
        let address2 = loaded_wallet.get_address();

        // Should have same address (deterministic)
        assert_eq!(address1, address2);
    }

    #[test]
    fn test_load_wallet_wrong_password() {
        let temp_dir = TempDir::new().unwrap();
        let _home_guard = crate::set_test_home(temp_dir.path());

        // Create wallet
        Wallet::create("test_wallet", "password123").unwrap();

        // Try to load with wrong password
        let result = Wallet::load("test_wallet", "wrong_password");
        assert!(result.is_err());
    }

    #[test]
    fn test_wallet_file_extension() {
        let temp_dir = TempDir::new().unwrap();
        let _home_guard = crate::set_test_home(temp_dir.path());

        let (_wallet, _) = Wallet::create("test_wallet", "password123").unwrap();

        // Check file has .wallet extension
        let wallet_dir = Wallet::get_wallet_dir();
        let wallet_file = wallet_dir.join("test_wallet.wallet");
        assert!(wallet_file.exists());
    }

    #[test]
    fn test_hd_derivation() {
        let temp_dir = TempDir::new().unwrap();
        let _home_guard = crate::set_test_home(temp_dir.path());

        let (wallet, _) = Wallet::create("test_wallet", "password123").unwrap();

        // Get addresses at different indices
        let addr0 = wallet.get_address_at_index(0);
        let addr1 = wallet.get_address_at_index(1);
        let addr2 = wallet.get_address_at_index(2);

        // All should be different (HD derivation working)
        assert_ne!(addr0, addr1);
        assert_ne!(addr1, addr2);
        assert_ne!(addr0, addr2);

        // All should be valid Bech32
        assert!(addr0.starts_with("tzei1"));
        assert!(addr1.starts_with("tzei1"));
        assert!(addr2.starts_with("tzei1"));
    }

    #[test]
    fn test_deterministic_addresses() {
        // Generate a valid ZeiCoin mnemonic (with BLAKE3 checksum)
        let mnemonic = zeicoin_bip39::generate_mnemonic().unwrap();

        let temp_dir1 = TempDir::new().unwrap();
        let _home_guard = crate::set_test_home(temp_dir1.path());
        let wallet1 = Wallet::restore("wallet1", &mnemonic, "password123").unwrap();

        let temp_dir2 = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir2.path());
        let wallet2 = Wallet::restore("wallet2", &mnemonic, "password123").unwrap();

        // Same mnemonic = same addresses
        assert_eq!(wallet1.get_address(), wallet2.get_address());
        assert_eq!(
            wallet1.get_address_at_index(5),
            wallet2.get_address_at_index(5)
        );
    }
}

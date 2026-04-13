// Integration tests for wallet module
// Run with: cargo test --test wallet_tests

use std::env;
use std::path::Path;
use std::sync::{Mutex, MutexGuard};
use tempfile::TempDir;

// Import our library modules
use app_lib::crypto;
use app_lib::wallet::{list_wallets, Wallet};

static TEST_ENV_LOCK: Mutex<()> = Mutex::new(());

fn set_test_home(path: &Path) -> MutexGuard<'static, ()> {
    let guard = TEST_ENV_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    env::set_var("HOME", path);
    guard
}

#[test]
fn test_create_and_load_wallet() {
    let temp_dir = TempDir::new().unwrap();
    let _home_guard = set_test_home(temp_dir.path());

    // Create wallet
    let (wallet, mnemonic) = Wallet::create("test_wallet", "password123").unwrap();
    assert_eq!(wallet.name, "test_wallet");
    assert_eq!(mnemonic.split_whitespace().count(), 12);

    let address1 = wallet.get_address();

    // Load wallet
    let loaded_wallet = Wallet::load("test_wallet", "password123").unwrap();
    let address2 = loaded_wallet.get_address();

    // Addresses should match
    assert_eq!(address1, address2);
}

#[test]
fn test_wallet_persistence() {
    let temp_dir = TempDir::new().unwrap();
    let _home_guard = set_test_home(temp_dir.path());

    Wallet::create("wallet1", "password123").unwrap();
    Wallet::create("wallet2", "password456").unwrap();

    let wallets = list_wallets().unwrap();
    assert_eq!(wallets.len(), 2);
    assert!(wallets.contains(&"wallet1".to_string()));
    assert!(wallets.contains(&"wallet2".to_string()));
}

#[test]
fn test_restore_wallet_same_address() {
    let temp_dir = TempDir::new().unwrap();
    let _home_guard = set_test_home(temp_dir.path());

    // Create wallet and get mnemonic
    let (wallet1, mnemonic) = Wallet::create("original", "password123").unwrap();
    let address1 = wallet1.get_address();

    // Restore from mnemonic
    let wallet2 = Wallet::restore("restored", &mnemonic, "different_password").unwrap();
    let address2 = wallet2.get_address();

    // Same mnemonic = same address
    assert_eq!(address1, address2);
}

#[test]
fn test_crypto_key_derivation() {
    let salt = crypto::generate_salt();
    let key1 = crypto::derive_key("my_password", &salt).unwrap();
    let key2 = crypto::derive_key("my_password", &salt).unwrap();

    // Same password + salt = same key
    assert_eq!(key1, key2);
}

#[test]
fn test_crypto_encryption_roundtrip() {
    let data = b"secret seed data";
    let salt = crypto::generate_salt();
    let nonce = crypto::generate_nonce();
    let key = crypto::derive_key("password", &salt).unwrap();

    let encrypted = crypto::encrypt(data, &key, &nonce).unwrap();
    let decrypted = crypto::decrypt(&encrypted, &key, &nonce).unwrap();

    assert_eq!(data.to_vec(), decrypted);
}

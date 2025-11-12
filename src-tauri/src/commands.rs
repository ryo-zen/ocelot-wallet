/// Tauri Commands - Matching CLI Bridge API
///
/// These commands provide the same functionality as the CLI Bridge
/// but run directly in the Tauri application without network calls.
use crate::wallet::{Wallet, WalletInfo, list_wallets};
use serde::Serialize;

/// Response format matching CLI Bridge
#[derive(Serialize, Debug)]
pub struct CommandResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T> CommandResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

/// Create wallet response
#[derive(Serialize)]
pub struct CreateWalletResponse {
    pub wallet_name: String,
    pub mnemonic: String,
    pub first_address: String,
}

/// Restore wallet response
#[derive(Serialize)]
pub struct RestoreWalletResponse {
    pub wallet_name: String,
    pub message: String,
}

/// List wallets response
#[derive(Serialize)]
pub struct ListWalletsResponse {
    pub wallets: Vec<String>,
}

/// Unlock wallet response
#[derive(Serialize)]
pub struct UnlockWalletResponse {
    pub name: String,
    pub address: String,
}

/// Balance response
#[derive(Serialize)]
pub struct BalanceResponse {
    pub balance: String,
}

/// Send transaction response
#[derive(Serialize, Debug)]
pub struct SendTransactionResponse {
    pub transaction_hash: String,
}

/// Transaction history response
#[derive(Serialize, Debug)]
pub struct TransactionHistoryResponse {
    pub transactions_json: String,
}

/// Create a new wallet
/// Matches CLI Bridge: wallet_create command
#[tauri::command]
pub fn create_wallet(
    name: String,
    password: String,
) -> CommandResponse<CreateWalletResponse> {
    match Wallet::create(&name, &password) {
        Ok((wallet, mnemonic)) => {
            let first_address = wallet.get_address();
            CommandResponse::success(CreateWalletResponse {
                wallet_name: name,
                mnemonic,
                first_address,
            })
        }
        Err(e) => CommandResponse::error(e),
    }
}

/// Restore wallet from mnemonic
/// Matches CLI Bridge: wallet_restore command
#[tauri::command]
pub fn restore_wallet(
    name: String,
    mnemonic: String,
    password: String,
) -> CommandResponse<RestoreWalletResponse> {
    match Wallet::restore(&name, &mnemonic, &password) {
        Ok(_) => CommandResponse::success(RestoreWalletResponse {
            wallet_name: name.clone(),
            message: format!("Wallet '{}' restored successfully", name),
        }),
        Err(e) => CommandResponse::error(e),
    }
}

/// List all wallets
/// Matches CLI Bridge: wallet_list command
#[tauri::command]
pub fn list_wallets_command() -> CommandResponse<ListWalletsResponse> {
    match list_wallets() {
        Ok(wallets) => CommandResponse::success(ListWalletsResponse { wallets }),
        Err(e) => CommandResponse::error(e),
    }
}

/// Unlock wallet and get address
/// Matches CLI Bridge: unlock command (part of session management)
#[tauri::command]
pub fn unlock_wallet(name: String, password: String) -> CommandResponse<UnlockWalletResponse> {
    match Wallet::load(&name, &password) {
        Ok(wallet) => {
            let address = wallet.get_address();
            CommandResponse::success(UnlockWalletResponse {
                name: name.clone(),
                address,
            })
        }
        Err(e) => CommandResponse::error(e),
    }
}

/// Get wallet address
/// Matches CLI Bridge: address command
#[tauri::command]
pub fn get_address(name: String, password: String) -> CommandResponse<String> {
    match Wallet::load(&name, &password) {
        Ok(wallet) => CommandResponse::success(wallet.get_address()),
        Err(e) => CommandResponse::error(e),
    }
}

/// Get balance for address
/// Matches CLI Bridge: balance command
#[tauri::command]
pub fn get_balance(address: String, rpc_url: String) -> CommandResponse<BalanceResponse> {
    use crate::api::ZeiCoinAPI;

    let api = ZeiCoinAPI::with_rpc_url(&rpc_url);
    match api.get_balance(&address) {
        Ok(balance) => CommandResponse::success(BalanceResponse {
            balance: balance.balance.to_string(),
        }),
        Err(e) => CommandResponse::error(format!("Failed to fetch balance: {}", e)),
    }
}

/// Send transaction
/// Matches CLI Bridge: send command
/// Note: This requires wallet unlock and transaction signing
#[tauri::command]
pub fn send_transaction(
    wallet_name: String,
    password: String,
    recipient: String,
    amount: u64,
    rpc_url: String,
) -> CommandResponse<SendTransactionResponse> {
    // Load wallet
    let wallet = match Wallet::load(&wallet_name, &password) {
        Ok(w) => w,
        Err(e) => return CommandResponse::error(format!("Failed to unlock wallet: {}", e)),
    };

    // Get sender address
    let sender_address = wallet.get_address();

    // Initialize API client
    let api = crate::api::ZeiCoinAPI::with_rpc_url(&rpc_url);

    // Get current nonce via JSON-RPC
    let nonce = match api.get_nonce(&sender_address) {
        Ok(n) => n,
        Err(e) => return CommandResponse::error(format!("Failed to get nonce: {}", e)),
    };

    // Get current blockchain height via JSON-RPC
    let current_height = match api.get_height() {
        Ok(h) => h,
        Err(e) => return CommandResponse::error(format!("Failed to get blockchain height: {}", e)),
    };

    // Get current timestamp in milliseconds (Unix timestamp)
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    // Set fee and expiry_height according to JSON-RPC guide
    let fee: u64 = 5000; // Standard fee: 0.00005 ZEI
    let expiry_height: u64 = current_height + 8640; // 24 hours (assuming 10s blocks)

    // Get sender public key (raw bytes)
    let sender_public_key_bytes = wallet.get_public_key();

    // Decode bech32 addresses to get raw 20-byte address data
    use crate::address::decode_address;
    let sender_bytes = match decode_address(&sender_address) {
        Ok(bytes) => bytes,
        Err(e) => return CommandResponse::error(format!("Failed to decode sender address: {}", e)),
    };
    let recipient_bytes = match decode_address(&recipient) {
        Ok(bytes) => bytes,
        Err(e) => return CommandResponse::error(format!("Failed to decode recipient address: {}", e)),
    };

    // Create binary transaction data for signing (matching Zig format exactly)
    let mut tx_data = Vec::new();

    // version (u16, little-endian)
    tx_data.extend_from_slice(&0u16.to_le_bytes());
    // flags (u16, little-endian)
    tx_data.extend_from_slice(&0u16.to_le_bytes());
    // sender address (21 bytes - full Address struct: version byte + 20-byte hash)
    tx_data.extend_from_slice(&sender_bytes);
    // recipient address (21 bytes - full Address struct: version byte + 20-byte hash)
    tx_data.extend_from_slice(&recipient_bytes);
    // amount (u64, little-endian)
    tx_data.extend_from_slice(&amount.to_le_bytes());
    // fee (u64, little-endian)
    tx_data.extend_from_slice(&fee.to_le_bytes());
    // nonce (u64, little-endian)
    tx_data.extend_from_slice(&nonce.to_le_bytes());
    // timestamp (u64, little-endian)
    tx_data.extend_from_slice(&timestamp.to_le_bytes());
    // expiry_height (u64, little-endian)
    tx_data.extend_from_slice(&expiry_height.to_le_bytes());
    // sender_public_key (32 bytes)
    tx_data.extend_from_slice(&sender_public_key_bytes);
    // script_version (u16, little-endian)
    tx_data.extend_from_slice(&0u16.to_le_bytes());
    // witness_data length (u32, little-endian) - empty
    tx_data.extend_from_slice(&0u32.to_le_bytes());
    // extra_data length (u32, little-endian) - empty
    tx_data.extend_from_slice(&0u32.to_le_bytes());

    // Hash the binary transaction data using BLAKE3 (ZeiCoin uses BLAKE3 for all hashing)
    let tx_hash = blake3::hash(&tx_data);
    let tx_hash_bytes: [u8; 32] = *tx_hash.as_bytes();

    // Sign the transaction
    let signature = match wallet.sign(&tx_hash_bytes) {
        Ok(sig) => hex::encode(sig),
        Err(e) => return CommandResponse::error(format!("Failed to sign transaction: {}", e)),
    };

    // Create signed transaction
    let signed_tx = crate::api::SignedTransaction {
        sender: sender_address.clone(),
        recipient: recipient.clone(),
        amount,
        fee,
        nonce,
        timestamp,
        expiry_height,
        signature: signature.clone(),
        sender_public_key: hex::encode(sender_public_key_bytes),
    };

    // Debug: Log transaction details
    eprintln!("Transaction details:");
    eprintln!("  Sender: {}", sender_address);
    eprintln!("  Recipient: {}", recipient);
    eprintln!("  Amount: {}", amount);
    eprintln!("  Fee: {}", fee);
    eprintln!("  Nonce: {}", nonce);
    eprintln!("  Timestamp: {}", timestamp);
    eprintln!("  Expiry Height: {}", expiry_height);
    eprintln!("  Current Height: {}", current_height);
    eprintln!("  Signature: {}", signature);
    eprintln!("  Sender Public Key: {}", hex::encode(sender_public_key_bytes));
    eprintln!("  TX hash (for signing): {}", hex::encode(&tx_hash_bytes));
    eprintln!("  TX data length: {} bytes", tx_data.len());
    eprintln!("  TX data (hex): {}", hex::encode(&tx_data));

    // Submit transaction via JSON-RPC
    match api.submit_transaction(signed_tx) {
        Ok(tx_hash) => CommandResponse::success(SendTransactionResponse {
            transaction_hash: tx_hash,
        }),
        Err(e) => CommandResponse::error(format!("Failed to submit transaction: {}", e)),
    }
}

/// Get wallet info (name and address)
/// Helper command for frontend
#[tauri::command]
pub fn get_wallet_info(name: String, password: String) -> CommandResponse<WalletInfo> {
    match Wallet::load(&name, &password) {
        Ok(wallet) => CommandResponse::success(WalletInfo {
            name: wallet.name.clone(),
            address: wallet.get_address(),
            mnemonic: None, // Don't expose mnemonic via this command
        }),
        Err(e) => CommandResponse::error(e),
    }
}

/// Get transaction history for an address
/// Fetches transactions from the Transaction API
#[tauri::command]
pub fn get_transactions(
    address: String,
    limit: u32,
    offset: u32,
    api_url: String,
) -> CommandResponse<TransactionHistoryResponse> {
    use crate::api::ZeiCoinAPI;

    let api = ZeiCoinAPI::with_base_url(&api_url);
    match api.get_transactions(&address, limit, offset) {
        Ok(transactions_json) => CommandResponse::success(TransactionHistoryResponse {
            transactions_json,
        }),
        Err(e) => CommandResponse::error(format!("Failed to fetch transactions: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_zeicoin_crypto_compatibility() {
        // Test that ZeiCoin BLAKE3 crypto works correctly
        use crate::wallet::Wallet;
        use crate::zeicoin_bip39;
        use tempfile::TempDir;

        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Generate a valid ZeiCoin mnemonic (with BLAKE3 checksum)
        let mnemonic = zeicoin_bip39::generate_mnemonic().unwrap();

        let wallet = Wallet::restore("test", &mnemonic, "password123").unwrap();
        let address = wallet.get_address();

        println!("\n========================================");
        println!("ZeiCoin BLAKE3-based address generation:");
        println!("Mnemonic: {}", mnemonic);
        println!("Address: {}", address);
        println!("========================================\n");

        // Address should start with tzei1
        assert!(address.starts_with("tzei1"));
    }

    #[test]
    fn test_zig_wallet_compatibility() {
        // Test that Rust generates SAME address as Zig for a known mnemonic
        use crate::wallet::Wallet;
        use crate::zeicoin_bip39;
        use crate::zeicoin_hd::HDKey;
        use tempfile::TempDir;

        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Test wallet mnemonic generated by Zig
        let mnemonic = "disorder curtain tribe digital level speak trust maze disorder injury boring secret";

        // Debug HD derivation step by step
        let seed = zeicoin_bip39::mnemonic_to_seed(mnemonic, None);
        println!("\n========================================");
        println!("DEBUG HD Derivation:");
        println!("Seed (hex): {}", hex::encode(&seed));

        let master = HDKey::from_seed(&seed).unwrap();
        println!("Master key: {}", hex::encode(&master.key));

        // m/44'
        let purpose = master.derive_child(0x80000000 | 44).unwrap();
        println!("m/44' key: {}", hex::encode(&purpose.key));

        // m/44'/882'
        let coin_type = purpose.derive_child(0x80000000 | 882).unwrap();
        println!("m/44'/882' key: {}", hex::encode(&coin_type.key));

        // m/44'/882'/0'
        let account = coin_type.derive_child(0x80000000 | 0).unwrap();
        println!("m/44'/882'/0' key: {}", hex::encode(&account.key));

        // m/44'/882'/0'/0
        let change = account.derive_child(0).unwrap();
        println!("m/44'/882'/0'/0 key: {}", hex::encode(&change.key));

        // m/44'/882'/0'/0/0
        let address_key = change.derive_child(0).unwrap();
        println!("m/44'/882'/0'/0/0 key: {}", hex::encode(&address_key.key));

        // Debug Ed25519 generation
        use sha2::{Digest, Sha512};
        let mut hasher = Sha512::new();
        hasher.update(&address_key.key);
        let hash = hasher.finalize();
        println!("\nEd25519 Debug:");
        println!("  Input seed: {}", hex::encode(&address_key.key));
        println!("  SHA-512 (first 32): {}", hex::encode(&hash[0..32]));
        println!("  SHA-512 (last 32):  {}", hex::encode(&hash[32..64]));

        // Manual clamping to see the scalar
        let mut scalar = [0u8; 32];
        scalar.copy_from_slice(&hash[0..32]);
        scalar[0] &= 248;
        scalar[31] &= 127;
        scalar[31] |= 64;
        println!("  Clamped scalar: {}", hex::encode(&scalar));

        let pubkey = address_key.get_public_key().unwrap();
        println!("Final public key: {}", hex::encode(&pubkey));

        let wallet = Wallet::restore("john_test", mnemonic, "password123").unwrap();
        let address = wallet.get_address();

        // Debug: print intermediate values
        let wallet_pubkey = wallet.get_public_key();
        println!("\n========================================");
        println!("Wallet Compatibility Test:");
        println!("Mnemonic: {}", mnemonic);
        println!("Public Key: {}", hex::encode(wallet_pubkey));
        println!("Rust Address:  {}", address);
        println!("Zig Address (coin type 882, BLAKE3): tzei1qzh7t4qqadlr99nl7ued6djja67a57ug2sc9xymd");
        println!("Match: {}", address == "tzei1qzh7t4qqadlr99nl7ued6djja67a57ug2sc9xymd");
        println!("========================================\n");

        // The address should match what Zig generates (with coin type 882 and BLAKE3)
        assert_eq!(address, "tzei1qzh7t4qqadlr99nl7ued6djja67a57ug2sc9xymd",
            "Rust must generate same address as Zig for same mnemonic!");
    }

    #[test]
    #[ignore] // Run with: cargo test test_wallet_compatibility -- --ignored --nocapture
    fn test_wallet_compatibility() {
        // Test Rust <-> Zig wallet compatibility
        use tempfile::TempDir;

        println!("\n🧪 WALLET COMPATIBILITY TEST: Rust <-> Zig");
        println!("{}", "=".repeat(60));

        // Use temp directory for test wallet
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Step 1: Create wallet in Rust
        println!("\n📝 Step 1: Creating wallet in Rust...");
        let wallet_name = "compat-test";
        let password = "testpass123";

        let create_result = create_wallet(wallet_name.to_string(), password.to_string());
        assert!(create_result.success, "Failed to create wallet");

        let wallet_data = create_result.data.unwrap();
        let rust_address = wallet_data.first_address.clone();
        let mnemonic = wallet_data.mnemonic.clone();

        println!("   ✅ Rust wallet created");
        println!("   📬 Rust Address: {}", rust_address);
        println!("   🔑 Mnemonic: {}", mnemonic);

        // Debug: Show intermediate values
        use crate::wallet::Wallet;
        let wallet = Wallet::load(wallet_name, password).expect("Failed to load wallet");
        let pubkey = wallet.get_public_key();
        println!("   🔐 Public Key (hex): {}", hex::encode(pubkey));

        // Step 2: Instructions for Zig restoration
        println!("\n📋 Step 2: Test Zig wallet restoration");
        println!("   Run this command on the server:");
        println!("   zeicoin wallet restore \"{}\" --name compat-test-zig", mnemonic);
        println!("   zeicoin address compat-test-zig");
        println!("");
        println!("   Expected address: {}", rust_address);
        println!("");
        println!("   ✅ If addresses match: Wallets are COMPATIBLE");
        println!("   ❌ If addresses differ: Wallets are INCOMPATIBLE");

        println!("\n✅ Test completed successfully");
        println!("{}", "=".repeat(60));
    }

    #[test]
    #[ignore] // Run with: cargo test test_send_real_transaction -- --ignored --nocapture
    fn test_send_real_transaction() {
        // Integration test: Send a real transaction to the blockchain
        use crate::wallet::Wallet;

        println!("\n🧪 INTEGRATION TEST: Send Transaction to Blockchain");
        println!("{}", "=".repeat(60));

        // Use REAL home directory to access existing wallets
        // Don't override HOME - use actual wallet directory

        // Step 1: Load existing wallet
        println!("\n📝 Step 1: Loading existing wallet...");
        let wallet_name = "new-wallet-3";
        let password = "testpass123";

        let wallet = Wallet::load(wallet_name, password).expect("Failed to load wallet");
        let sender_address = wallet.get_address();

        println!("   ✅ Wallet loaded successfully");
        println!("   📬 Address: {}", sender_address);
        println!("   💼 Wallet: {}", wallet_name);

        // Step 2: Send transaction
        println!("\n📤 Step 2: Sending transaction...");
        let recipient = "tzei1qqleg82zpuvlducwahpjfsjuqhh0z30d35ms3h82"; // nikki
        let amount = 1_000_000_000u64; // 1 ZEI

        println!("   From: {}", sender_address);
        println!("   To: {}", recipient);
        println!("   Amount: {} ZEI", amount as f64 / 1_000_000_000.0);

        let response = send_transaction(
            wallet_name.to_string(),
            password.to_string(),
            recipient.to_string(),
            amount,
        );

        println!("\n📊 Transaction result:");
        if response.success {
            println!("   ✅ Transaction sent successfully!");
            println!("   🔗 TX Hash: {:?}", response.data);
        } else {
            println!("   ❌ Transaction failed!");
            println!("   ⚠️  Error: {:?}", response.error);
            panic!("Transaction failed: {:?}", response.error);
        }

        println!("\n✅ Test completed successfully");
        println!("{}", "=".repeat(60));
    }

    #[test]
    fn test_create_wallet_command() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        let response = create_wallet("test_wallet".to_string(), "password123".to_string());
        assert!(response.success);
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        assert_eq!(data.wallet_name, "test_wallet");
        assert!(data.first_address.starts_with("tzei1"));
        assert_eq!(data.mnemonic.split_whitespace().count(), 12);
    }

    #[test]
    fn test_restore_wallet_command() {
        use crate::zeicoin_bip39;

        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Generate a valid ZeiCoin mnemonic (with BLAKE3 checksum)
        let mnemonic = zeicoin_bip39::generate_mnemonic().unwrap();
        let response = restore_wallet(
            "restored".to_string(),
            mnemonic,
            "password123".to_string(),
        );

        assert!(response.success);
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        assert_eq!(data.wallet_name, "restored");
    }

    #[test]
    fn test_list_wallets_command() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Create a wallet first
        create_wallet("test1".to_string(), "password123".to_string());
        create_wallet("test2".to_string(), "password123".to_string());

        let response = list_wallets_command();
        assert!(response.success);
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        assert_eq!(data.wallets.len(), 2);
        assert!(data.wallets.contains(&"test1".to_string()));
        assert!(data.wallets.contains(&"test2".to_string()));
    }

    #[test]
    fn test_unlock_wallet_command() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Create wallet first
        let create_response = create_wallet("test".to_string(), "password123".to_string());
        let expected_address = create_response.data.unwrap().first_address;

        // Unlock it
        let response = unlock_wallet("test".to_string(), "password123".to_string());
        assert!(response.success);
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        assert_eq!(data.name, "test");
        assert_eq!(data.address, expected_address);
    }

    #[test]
    fn test_unlock_wallet_wrong_password() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Create wallet
        create_wallet("test".to_string(), "password123".to_string());

        // Try to unlock with wrong password
        let response = unlock_wallet("test".to_string(), "wrongpassword".to_string());
        assert!(!response.success);
        assert!(response.error.is_some());
    }

    #[test]
    fn test_get_address_command() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("HOME", temp_dir.path());

        // Create wallet
        let create_response = create_wallet("test".to_string(), "password123".to_string());
        let expected_address = create_response.data.unwrap().first_address;

        // Get address
        let response = get_address("test".to_string(), "password123".to_string());
        assert!(response.success);
        assert!(response.data.is_some());
        assert_eq!(response.data.unwrap(), expected_address);
    }
}

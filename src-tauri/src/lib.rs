// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

// Wallet modules
pub mod address; // Bech32 address encoding
pub mod api; // Transaction API client
pub mod commands; // Tauri commands
pub mod crypto; // Cryptographic primitives
pub mod hd; // HD key derivation (BIP32/BIP44)
pub mod wallet; // Wallet management
pub mod zeicoin_bip39; // ZeiCoin BIP39 with BLAKE3 (optimized for performance)
pub mod zeicoin_hd; // ZeiCoin HD derivation with BLAKE3 (Ed25519 keys)

#[cfg(test)]
pub(crate) static TEST_ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(test)]
pub(crate) fn set_test_home(path: &std::path::Path) -> std::sync::MutexGuard<'static, ()> {
    let guard = TEST_ENV_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    std::env::set_var("HOME", path);
    guard
}

// Re-export for convenience
pub use address::{decode_address, encode_address, validate_address};
pub use api::ZeiCoinAPI;
pub use hd::HDKey;
pub use wallet::{list_wallets, Wallet, WalletInfo};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                // Enable MCP plugin in debug mode for AI-assisted testing (if feature is enabled)
                #[cfg(feature = "mcp")]
                {
                    log::info!("Development build detected, enabling MCP plugin");
                    app.handle().plugin(tauri_plugin_mcp::init_with_config(
                        tauri_plugin_mcp::PluginConfig::new("ocelot-wallet".to_string())
                            .start_socket_server(true)
                            .socket_path("/tmp/ocelot-wallet-mcp.sock".into()),
                    ))?;
                }

                #[cfg(not(feature = "mcp"))]
                {
                    log::info!("Development build without MCP plugin");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_wallet,
            commands::restore_wallet,
            commands::list_wallets_command,
            commands::unlock_wallet,
            commands::get_address,
            commands::get_balance,
            commands::send_transaction,
            commands::get_wallet_info,
            commands::get_transactions,
            commands::create_encrypted_backup,
            commands::create_plaintext_backup,
            commands::restore_from_encrypted_backup,
            commands::restore_from_plaintext_backup,
            commands::call_faucet,
            commands::send_l2_message,
            commands::get_contacts,
            commands::save_contacts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

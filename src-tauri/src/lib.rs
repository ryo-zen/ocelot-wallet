// Wallet modules
pub mod address;   // Bech32 address encoding
pub mod api;       // Transaction API client
pub mod commands;  // Tauri commands
pub mod crypto;    // Cryptographic primitives
pub mod hd;        // HD key derivation (BIP32/BIP44)
pub mod wallet;    // Wallet management
pub mod zeicoin_bip39;  // ZeiCoin custom BIP39 (BLAKE3-based)
pub mod zeicoin_hd;     // ZeiCoin custom HD derivation (BLAKE3-based)

// Re-export for convenience
pub use address::{encode_address, decode_address, validate_address};
pub use api::ZeiCoinAPI;
pub use hd::HDKey;
pub use wallet::{Wallet, WalletInfo, list_wallets};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
          app.handle().plugin(
            tauri_plugin_mcp::init_with_config(
              tauri_plugin_mcp::PluginConfig::new("zii-wallet".to_string())
                .start_socket_server(true)
                .socket_path("/tmp/zii-wallet-mcp.sock".into())
            )
          )?;
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
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

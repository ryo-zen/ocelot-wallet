<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

  <div align="center">   
<img width="310" height="310" alt="Square310x310Logo" src="https://github.com/user-attachments/assets/052ed7a5-9374-441f-91cf-9c8c3dc3a179" />


  </div>  

<p align="center">
  <a href="https://zeicoin.com/download/"><img alt="Website" src="https://img.shields.io/website?url=https%3A%2F%2Fzeicoin.com%2Fdownload%2F&label=wallet%20site"></a>
  <a href="https://github.com/ryo-zen/ocelot-wallet/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/ryo-zen/ocelot-wallet?style=flat"></a>
  <a href="https://discord.gg/rUC4HyTk"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://zeicoin.com/download/">Website</a> ·
  <a href="https://discord.gg/rUC4HyTk">Discord</a>
</p>

> [!CAUTION]
> **Official repositories only:**
> - Wallet: https://github.com/ryo-zen/ocelot-wallet
> - ZeiCoin: https://github.com/ryo-zen/zeicoin
>
> Any other repository is not affiliated with this project. Always download from the official repositories listed above.

> [!WARNING]
> **Pre-release software — not ready for production use.**
> This is an alpha release (v0.1.0-alpha.1). Expect bugs, breaking changes, and missing features. Do not use with real funds. Only official source releases are published here — be cautious of any third-party binaries claiming to be Ocelot Wallet.

# Ocelot Wallet

A secure non-custodial desktop wallet for ZeiCoin cryptocurrency, built with SvelteKit 5 and Tauri 2.

# Status

The wallet is currently in alpha. ZeiCoin is in testnet.

## Features

- **Non-Custodial Security**: Your keys, your coins - wallet files encrypted locally
- **BIP39/BIP44 Standard**: Industry-standard HD wallet with 12-word recovery phrases
- **Native Desktop App**: Built with Tauri for cross-platform support (Windows, macOS, Linux)
- **Modern UI**: Clean interface built with SvelteKit and ShadCN/UI components
- **Strong Encryption**: Argon2id KDF + AES-256-GCM encryption for wallet files
- **Transaction Management**: Send ZeiCoin with optional L2 message enhancements
- **L2 Messaging**: Send and receive on-chain messages; compose messages with dust + fee
- **Address Book**: Save, categorize, and manage recipient contacts
- **Balance Tracking**: Real-time balance updates from the blockchain
- **Session Security**: 30-minute auto-logout for enhanced security

## Architecture

**Frontend:**
- SvelteKit 5 + TypeScript
- Tailwind CSS 4
- ShadCN/UI Svelte Components
- Vitest for testing

**Backend:**
- Tauri 2 (Rust) for secure wallet operations
- Direct IPC communication (no HTTP overhead)
- Local encrypted wallet file storage
- Bech32 address encoding (tzei1... prefix)

**Blockchain Integration:**
- Transaction API for balance queries and broadcasting
- JSON-RPC integration with ZeiCoin blockchain
- HD derivation path: m/44'/882'/0'/0/{index}

## Development Setup

### Prerequisites

- **Bun**: Package manager — [install](https://bun.sh)
- **Rust**: For Tauri backend — [install via rustup](https://rustup.rs/)

### Installation

```bash
# Clone the repository
git clone https://github.com/ryo-zen/ocelot-wallet.git
cd ocelot-wallet

# Install dependencies
bun install

# Start in development mode
bun tauri dev
```

### Configuration

Create a `.env` file based on `.env.example`:

```bash
# Transaction API endpoint (adjust to your server)
# Production uses HTTPS with TLS 1.3
ZEICOIN_TRANSACTION_API_URL=https://api.zei.network
PUBLIC_TRANSACTION_API_URL=https://api.zei.network
```

### Building for Production

```bash
# Build the desktop application
bun tauri build

# Output will be in: src-tauri/target/release/
```

## Testing

```bash
# Run frontend tests
bunx vitest run

# Run frontend tests in watch mode
bunx vitest watch

# Run Rust backend tests
cd src-tauri
cargo test --lib -- --test-threads=1
```

**Test Coverage:**
- Frontend: 30/30 tests passing (18 API + 12 auth)
- Backend: 41/41 tests passing

## Usage

### Creating a Wallet

1. Launch the application
2. Click "Create New Wallet"
3. Enter wallet name and password
4. **Important**: Write down your 12-word recovery phrase
5. Confirm the recovery phrase
6. Your wallet is ready to use

### Restoring a Wallet

1. Click "Restore Wallet" from login screen
2. Enter your 12-word recovery phrase **or** import a `.zeibackup` file
3. Create a new password
4. Your wallet will be restored with all funds intact

### Sending ZeiCoin

1. Navigate to Send in the sidebar
2. Enter recipient address (tzei1...)
3. Enter amount to send
4. Optionally add an L2 message
5. Review and confirm transaction
6. Enter your password to sign

## Security

- **Private Keys**: Never leave Rust process memory
- **Wallet Files**: Encrypted with Argon2id + AES-256-GCM
- **Session Management**: Auto-logout after 30 minutes of inactivity
- **No Network Exposure**: All wallet operations via secure Tauri IPC
- **Password Protection**: All operations require password authentication

### Security Best Practices

- **Never share your recovery phrase** - Anyone with it can access your funds
- **Use strong passwords** - Your wallet encryption depends on it
- **Backup your recovery phrase** - Store it securely offline
- **Keep software updated** - Security patches are important

## Project Structure

```
ocelot-wallet/
├── src/                      # SvelteKit frontend
│   ├── routes/
│   │   ├── login/           # Wallet selection and login
│   │   ├── wallet/
│   │   │   ├── create/      # Multi-step wallet creation
│   │   │   ├── restore/     # Wallet restoration
│   │   │   ├── dashboard/   # Balance and overview
│   │   │   ├── send/        # Send ZeiCoin
│   │   │   ├── transactions/# Transaction history
│   │   │   └── address-book/# Contact management
│   │   ├── messages/        # L2 message inbox
│   │   │   └── compose/     # Compose L2 message
│   │   └── settings/        # Application settings
│   └── lib/
│       ├── components/      # Svelte components
│       ├── stores/          # State management
│       ├── services/        # API clients
│       └── config/          # Configuration
├── src-tauri/               # Tauri Rust backend
│   └── src/
│       ├── commands.rs      # Tauri command handlers
│       ├── wallet.rs        # Wallet management
│       ├── crypto.rs        # Encryption
│       ├── hd.rs            # HD derivation
│       ├── zeicoin_hd.rs    # ZeiCoin-specific HD derivation
│       ├── zeicoin_bip39.rs # BIP39 mnemonic handling
│       ├── address.rs       # Address encoding
│       ├── decode_address.rs# Address decoding
│       └── api.rs           # Transaction API client
└── static/                  # Static assets
```

## Technology Stack

- **SvelteKit 5**: Modern reactive framework
- **Tauri 2**: Secure desktop application framework
- **TypeScript**: Type-safe development
- **Rust**: Secure backend implementation
- **Tailwind CSS 4**: Utility-first styling
- **Vitest**: Fast unit testing
- **Bech32**: Address encoding standard
- **Ed25519**: Digital signatures
- **SHA3-256**: Cryptographic hashing

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions

## Disclaimer

**ZeiCoin is currently in TestNet and active development. Use at your own risk.**

This is cryptocurrency wallet software. While we implement industry-standard security practices, you are responsible for:
- Keeping your recovery phrase secure
- Using strong passwords
- Maintaining backups
- Understanding the risks of cryptocurrency transactions

Use at your own risk. Always test with small amounts first.

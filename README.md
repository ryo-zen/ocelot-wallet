# Ocelot Wallet

A secure non-custodial desktop wallet for ZeiCoin cryptocurrency, built with SvelteKit and Tauri.

## Features

- **Non-Custodial Security**: Your keys, your coins - wallet files encrypted locally
- **BIP39/BIP44 Standard**: Industry-standard HD wallet with 12-word recovery phrases
- **Native Desktop App**: Built with Tauri for cross-platform support (Windows, macOS, Linux)
- **Modern UI**: Clean interface built with SvelteKit and ShadCN/UI components
- **Strong Encryption**: Argon2id KDF + AES-256-GCM encryption for wallet files
- **Transaction Management**: Send ZeiCoin with optional L2 message enhancements
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

- **Bun**: Package manager (or npm/pnpm/yarn)
- **Rust**: For Tauri backend (install via [rustup](https://rustup.rs/))
- **Node.js**: v18 or higher
- **Transaction API**: Running ZeiCoin transaction API with HTTPS (production: https://209.38.31.77:443)

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
ZEICOIN_SERVER_URL=https://209.38.31.77:443
PUBLIC_ZEICOIN_SERVER_URL=https://209.38.31.77:443
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
npx vitest run

# Run frontend tests in watch mode
npx vitest watch

# Run Rust backend tests
cd src-tauri
cargo test --lib -- --test-threads=1
```

**Test Coverage:**
- Frontend: 30/30 tests passing (18 API + 12 auth)
- Backend: 34/34 tests passing (100% coverage)

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
2. Enter your 12-word recovery phrase
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
│   ├── routes/              # Application pages
│   ├── lib/
│   │   ├── components/      # Svelte components
│   │   ├── stores/          # State management
│   │   ├── services/        # API clients
│   │   └── config/          # Configuration
│   └── tests/               # Frontend tests
├── src-tauri/               # Tauri Rust backend
│   ├── src/
│   │   ├── commands.rs      # Tauri command handlers
│   │   ├── wallet.rs        # Wallet management
│   │   ├── crypto.rs        # Encryption
│   │   ├── hd.rs           # HD derivation
│   │   ├── address.rs      # Address encoding
│   │   └── api.rs          # Transaction API client
│   └── tests/              # Backend tests
└── static/                 # Static assets
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

[Add your license here - e.g., MIT, Apache 2.0, etc.]

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions

## Disclaimer

This is cryptocurrency wallet software. While we implement industry-standard security practices, you are responsible for:
- Keeping your recovery phrase secure
- Using strong passwords
- Maintaining backups
- Understanding the risks of cryptocurrency transactions

Use at your own risk. Always test with small amounts first.

/// Cryptography module for wallet encryption and signing
///
/// Minimal, modular cryptographic primitives:
/// - Password-based key derivation (Argon2)
/// - AES-256-GCM encryption/decryption
/// - Ed25519 signing
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    Algorithm, Argon2, Params, Version,
};
use ed25519_dalek::{Signature, Signer, SigningKey};

/// Argon2 parameters matching Zig implementation
/// Security: Argon2id with 64MB memory, 3 iterations, 1 thread
const ARGON2_MEMORY_COST: u32 = 65536; // 64 MB (in KiB)
const ARGON2_TIME_COST: u32 = 3;
const ARGON2_PARALLELISM: u32 = 1;

/// Derive a 32-byte encryption key from password using Argon2id
/// Matches Zig implementation: t=3, m=64MB, p=1, mode=argon2id
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    if salt.len() < 16 {
        return Err("Salt must be at least 16 bytes".to_string());
    }

    // Create Argon2id instance with parameters matching Zig
    let params = Params::new(
        ARGON2_MEMORY_COST,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(32), // Output length
    )
    .map_err(|e| format!("Invalid Argon2 params: {}", e))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; 32];

    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    Ok(key)
}

/// Generate a random 32-byte salt for key derivation
pub fn generate_salt() -> [u8; 32] {
    let mut salt = [0u8; 32];
    getrandom::getrandom(&mut salt).expect("Failed to generate random salt");
    salt
}

/// Generate a random 12-byte nonce for AES-GCM
pub fn generate_nonce() -> [u8; 12] {
    let mut nonce = [0u8; 12];
    getrandom::getrandom(&mut nonce).expect("Failed to generate random nonce");
    nonce
}

/// Encrypt data using AES-256-GCM
pub fn encrypt(data: &[u8], key: &[u8; 32], nonce: &[u8; 12]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce_ref = Nonce::from(*nonce);

    cipher
        .encrypt(&nonce_ref, data)
        .map_err(|e| format!("Encryption failed: {}", e))
}

/// Decrypt data using AES-256-GCM
pub fn decrypt(encrypted: &[u8], key: &[u8; 32], nonce: &[u8; 12]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce_ref = Nonce::from(*nonce);

    cipher
        .decrypt(&nonce_ref, encrypted)
        .map_err(|_| "Decryption failed (invalid password?)".to_string())
}

/// Sign a message hash using Ed25519
pub fn sign_message(signing_key: &SigningKey, message_hash: &[u8; 32]) -> Vec<u8> {
    let signature: Signature = signing_key.sign(message_hash);
    signature.to_bytes().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let password = "test_password_123";
        let salt = generate_salt();

        let key1 = derive_key(password, &salt).unwrap();
        let key2 = derive_key(password, &salt).unwrap();

        // Same password + salt = same key
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_key_derivation_different_salt() {
        let password = "test_password_123";
        let salt1 = generate_salt();
        let salt2 = generate_salt();

        let key1 = derive_key(password, &salt1).unwrap();
        let key2 = derive_key(password, &salt2).unwrap();

        // Different salt = different key
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_encryption_decryption() {
        let data = b"secret wallet seed";
        let password = "my_password";
        let salt = generate_salt();
        let nonce = generate_nonce();

        let key = derive_key(password, &salt).unwrap();

        // Encrypt
        let encrypted = encrypt(data, &key, &nonce).unwrap();
        assert_ne!(encrypted, data);

        // Decrypt
        let decrypted = decrypt(&encrypted, &key, &nonce).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_encryption_wrong_password() {
        let data = b"secret wallet seed";
        let password = "my_password";
        let wrong_password = "wrong_password";
        let salt = generate_salt();
        let nonce = generate_nonce();

        let key = derive_key(password, &salt).unwrap();
        let wrong_key = derive_key(wrong_password, &salt).unwrap();

        // Encrypt with correct password
        let encrypted = encrypt(data, &key, &nonce).unwrap();

        // Decrypt with wrong password should fail
        let result = decrypt(&encrypted, &wrong_key, &nonce);
        assert!(result.is_err());
    }

    #[test]
    fn test_signing() {
        use rand::rngs::OsRng;
        let mut rng = OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let message = b"transaction data to sign";

        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(message);
        let hash: [u8; 32] = hasher.finalize().into();

        let signature = sign_message(&signing_key, &hash);

        // Signature should be 64 bytes for Ed25519
        assert_eq!(signature.len(), 64);
    }

    #[test]
    fn test_salt_too_small() {
        let password = "test_password";
        let salt = [0u8; 8]; // Too small

        let result = derive_key(password, &salt);
        assert!(result.is_err());
    }
}

/// Address encoding for ZeiCoin
///
/// Implements Bech32 encoding matching Zig implementation:
/// - Human-readable prefix: "tzei"
/// - Bech32 encoding with checksums
/// - BLAKE3 hashing (modern, fast, secure)
/// - Supports both encoding and decoding
use bech32::{Bech32, Hrp};
use ed25519_dalek::VerifyingKey;

/// Human-readable part for ZeiCoin addresses
const ZEICOIN_HRP: &str = "tzei";

/// Encode a public key as a Bech32 ZeiCoin address
/// Format: tzei1{bech32_encoded_hash}
pub fn encode_address(public_key: &VerifyingKey) -> Result<String, String> {
    // Get public key bytes
    let pubkey_bytes = public_key.to_bytes();

    // BLAKE3 hash (matching Zig's blake3Hash function)
    let hash = blake3::hash(&pubkey_bytes);

    // Take first 20 bytes of hash for address
    let address_bytes = &hash.as_bytes()[..20];

    // Prepend witness version 0
    let mut data = vec![0u8];
    data.extend_from_slice(address_bytes);

    // Create HRP (human-readable part)
    let hrp = Hrp::parse(ZEICOIN_HRP)
        .map_err(|e| format!("Invalid HRP: {}", e))?;

    // Encode as Bech32
    let encoded = bech32::encode::<Bech32>(hrp, &data)
        .map_err(|e| format!("Bech32 encoding failed: {}", e))?;

    Ok(encoded)
}

/// Decode a Bech32 ZeiCoin address
/// Returns the full 21-byte address (1 byte version + 20 byte hash)
/// This matches Zig's Address struct format
pub fn decode_address(address: &str) -> Result<Vec<u8>, String> {
    // Decode Bech32
    let (hrp, data) = bech32::decode(address)
        .map_err(|e| format!("Bech32 decoding failed: {}", e))?;

    // Verify HRP
    if hrp.as_str() != ZEICOIN_HRP {
        return Err(format!(
            "Invalid address prefix: expected '{}', got '{}'",
            ZEICOIN_HRP,
            hrp.as_str()
        ));
    }

    // Verify length (21 bytes: 1 witness version + 20 address bytes)
    if data.len() != 21 {
        return Err(format!(
            "Invalid address length: expected 21 bytes (with witness version), got {}",
            data.len()
        ));
    }

    // Verify witness version is 0
    if data[0] != 0 {
        return Err(format!("Invalid witness version: expected 0, got {}", data[0]));
    }

    // Return FULL address bytes including witness version (matching Zig's Address struct)
    Ok(data.to_vec())
}

/// Validate a ZeiCoin address format
pub fn validate_address(address: &str) -> bool {
    decode_address(address).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;

    #[test]
    fn test_encode_address() {
        let mut rng = OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let address = encode_address(&verifying_key).unwrap();

        // Address should start with "tzei1"
        assert!(address.starts_with("tzei1"));
        // Should be valid Bech32
        assert!(address.len() > 5);
    }

    #[test]
    fn test_decode_address() {
        let mut rng = OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let address = encode_address(&verifying_key).unwrap();
        let decoded = decode_address(&address).unwrap();

        // Decoded should be 21 bytes (1 witness version + 20 address hash)
        assert_eq!(decoded.len(), 21);
        // Witness version should be 0
        assert_eq!(decoded[0], 0);
    }

    #[test]
    fn test_encode_decode_roundtrip() {
        let mut rng = OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let address = encode_address(&verifying_key).unwrap();
        let decoded = decode_address(&address).unwrap();

        // Re-encode and verify it matches (using BLAKE3)
        let pubkey_bytes = verifying_key.to_bytes();

        let hash = blake3::hash(&pubkey_bytes);

        // Expected: [witness_version(0), ...hash[0..20]]
        let mut expected_bytes = vec![0u8];
        expected_bytes.extend_from_slice(&hash.as_bytes()[..20]);

        assert_eq!(decoded, expected_bytes);
    }

    #[test]
    fn test_validate_address() {
        let mut rng = OsRng;
        let signing_key = SigningKey::generate(&mut rng);
        let verifying_key = signing_key.verifying_key();

        let address = encode_address(&verifying_key).unwrap();

        // Valid address
        assert!(validate_address(&address));

        // Invalid addresses
        assert!(!validate_address("invalid"));
        assert!(!validate_address("tzei1invalid"));
        assert!(!validate_address("btc1qwhatever"));
    }

    #[test]
    fn test_deterministic_address() {
        use bip39::Mnemonic;
        use std::str::FromStr;

        // Same mnemonic should produce same address
        let mnemonic_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = Mnemonic::from_str(mnemonic_phrase).unwrap();
        let seed = mnemonic.to_seed("");

        // Derive same key twice
        let mut seed_bytes = [0u8; 32];
        seed_bytes.copy_from_slice(&seed[..32]);
        let signing_key1 = SigningKey::from_bytes(&seed_bytes);
        let signing_key2 = SigningKey::from_bytes(&seed_bytes);

        let address1 = encode_address(&signing_key1.verifying_key()).unwrap();
        let address2 = encode_address(&signing_key2.verifying_key()).unwrap();

        assert_eq!(address1, address2);
    }

    #[test]
    fn test_invalid_hrp() {
        // Try to decode address with wrong HRP
        let result = decode_address("btc1qwhatever1234567890");
        match result {
            Err(msg) => {
                // Accept either "Invalid address prefix" or bech32 decoding error
                assert!(msg.contains("Invalid address") || msg.contains("decoding failed") || msg.contains("prefix"));
            },
            Ok(_) => panic!("Should have failed with invalid HRP"),
        }
    }
}

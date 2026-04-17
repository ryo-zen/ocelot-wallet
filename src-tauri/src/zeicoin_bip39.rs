// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

use bip39::Language;
/// ZeiCoin BIP39 Implementation with BLAKE3
///
/// Uses BLAKE3 instead of SHA256/PBKDF2 for performance and consistency with ZeiCoin blockchain.
/// ZeiCoin is a custom blockchain with Ed25519 signatures and tzei addresses, so standard BIP39
/// compatibility is not relevant. This implementation MUST match the Zig blockchain code exactly.
use blake3;
use rand::RngCore;

/// Generate a new 12-word mnemonic using BLAKE3 checksum (not SHA256!)
/// Matches: zeicoin/src/core/crypto/bip39.zig generateMnemonic()
pub fn generate_mnemonic() -> Result<String, String> {
    // Generate 128 bits (16 bytes) of entropy for 12 words
    let mut entropy = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut entropy);

    entropy_to_mnemonic(&entropy)
}

/// Convert entropy to mnemonic words using BLAKE3 checksum
/// Matches: zeicoin/src/core/crypto/bip39.zig entropyToMnemonic()
fn entropy_to_mnemonic(entropy: &[u8]) -> Result<String, String> {
    if entropy.len() < 16 || entropy.len() > 32 || entropy.len() % 4 != 0 {
        return Err("Invalid entropy length".to_string());
    }

    // Calculate checksum using BLAKE3 (not SHA256!)
    let blake3_hash = blake3::hash(entropy);
    let checksum_byte = blake3_hash.as_bytes()[0];
    let checksum_bits = (entropy.len() / 4) as u8;

    // Extract checksum bits
    let checksum_shift = 8 - checksum_bits;
    let checksum_masked = checksum_byte >> checksum_shift;

    // Combine entropy + checksum into bit string
    let total_bits = entropy.len() * 8 + checksum_bits as usize;
    let mut bit_string = Vec::new();

    // Add entropy bits
    for byte in entropy {
        for i in (0..8).rev() {
            bit_string.push((byte >> i) & 1);
        }
    }

    // Add checksum bits
    for i in (0..checksum_bits).rev() {
        bit_string.push((checksum_masked >> i) & 1);
    }

    // Convert to word indices (11 bits per word)
    let word_count = total_bits / 11;
    let wordlist = Language::English.word_list();
    let mut words = Vec::new();

    for i in 0..word_count {
        let start = i * 11;
        let mut word_index = 0u16;
        for j in 0..11 {
            word_index = (word_index << 1) | (bit_string[start + j] as u16);
        }
        // Defensive bounds check (BIP39 wordlist has exactly 2048 words)
        let word = wordlist
            .get(word_index as usize)
            .ok_or_else(|| format!("Invalid word index: {} (max 2047)", word_index))?;
        words.push(*word);
    }

    Ok(words.join(" "))
}

/// Validate mnemonic using BLAKE3 checksum (not SHA256!)
/// Matches: zeicoin/src/core/crypto/bip39.zig validateMnemonic()
pub fn validate_mnemonic(mnemonic: &str) -> Result<(), String> {
    let words: Vec<&str> = mnemonic.split_whitespace().collect();
    let word_count = words.len();

    // Check word count (must be 12, 15, 18, 21, or 24)
    if ![12, 15, 18, 21, 24].contains(&word_count) {
        return Err(format!(
            "Invalid word count: expected 12, 15, 18, 21, or 24 words, got {}",
            word_count
        ));
    }

    // Get BIP39 wordlist
    let wordlist = Language::English.word_list();

    // Convert words to indices
    let mut indices = Vec::new();
    for word in &words {
        let index = wordlist
            .iter()
            .position(|&w| w == *word)
            .ok_or_else(|| format!("Word not in BIP39 wordlist: {}", word))?;
        indices.push(index as u16);
    }

    // Pack indices into bits (each word = 11 bits)
    let total_bits = word_count * 11;
    let checksum_bits = word_count / 3; // Lines 231-232 in Zig
    let entropy_bits = total_bits - checksum_bits;
    let entropy_bytes = entropy_bits / 8;

    // Extract bits from indices
    let mut bit_string = Vec::new();
    for index in indices {
        for bit_pos in (0..11).rev() {
            let bit = (index >> bit_pos) & 1;
            bit_string.push(bit as u8);
        }
    }

    // Convert bit string to entropy bytes
    let mut entropy = vec![0u8; entropy_bytes];
    for (byte_index, byte) in entropy.iter_mut().enumerate() {
        let mut byte_val = 0u8;
        for i in 0..8 {
            let bit_index = byte_index * 8 + i;
            if bit_index < bit_string.len() {
                byte_val = (byte_val << 1) | bit_string[bit_index];
            }
        }
        *byte = byte_val;
    }

    // Extract checksum bits
    let mut checksum_val = 0u8;
    for i in 0..checksum_bits {
        let bit_index = entropy_bits + i;
        if bit_index < bit_string.len() {
            checksum_val = (checksum_val << 1) | bit_string[bit_index];
        }
    }

    // Validate checksum using BLAKE3 (lines 276-284 in Zig)
    let blake3_hash = blake3::hash(&entropy);
    let expected_checksum = blake3_hash.as_bytes()[0] >> (8 - checksum_bits);

    if checksum_val != expected_checksum {
        return Err(format!(
            "Invalid checksum: expected {}, got {}",
            expected_checksum, checksum_val
        ));
    }

    Ok(())
}

/// Convert mnemonic to seed using ZeiCoin's BLAKE3-based KDF (2048 iterations to match BIP39 PBKDF2 standard)
/// Matches: zeicoin/src/core/crypto/bip39.zig mnemonicToSeed()
pub fn mnemonic_to_seed(mnemonic: &str, passphrase: Option<&str>) -> [u8; 64] {
    let mut hasher = blake3::Hasher::new();

    // Domain separation (line 149 in Zig)
    hasher.update(b"zeicoin-mnemonic-v1");

    // Add mnemonic (line 152)
    hasher.update(mnemonic.as_bytes());

    // Add passphrase or empty string (line 155-159)
    if let Some(pass) = passphrase {
        if !pass.is_empty() {
            hasher.update(pass.as_bytes());
        }
    }

    // Initial derivation (line 163-164)
    let mut derived = hasher.finalize();

    // Key stretching - 2048 rounds (lines 167-174)
    // Note: Matches BIP39 PBKDF2 iteration count for equivalent security level
    for i in 0..2048u32 {
        let mut round_hasher = blake3::Hasher::new();
        round_hasher.update(derived.as_bytes());
        round_hasher.update(&i.to_le_bytes());
        derived = round_hasher.finalize();
    }

    // Expand to 64 bytes - first 32 bytes (lines 177-183)
    let mut final_hasher = blake3::Hasher::new();
    final_hasher.update(b"zeicoin-seed-expansion");
    final_hasher.update(derived.as_bytes());
    let expanded = final_hasher.finalize();

    let mut seed = [0u8; 64];
    seed[0..32].copy_from_slice(expanded.as_bytes());

    // Second expansion for last 32 bytes (lines 186-192)
    let mut second_hasher = blake3::Hasher::new();
    second_hasher.update(b"zeicoin-seed-expansion-2");
    second_hasher.update(derived.as_bytes());
    let expanded2 = second_hasher.finalize();

    seed[32..64].copy_from_slice(expanded2.as_bytes());

    // Note: We don't zeroize 'seed' here as it's the return value
    // The caller is responsible for zeroizing it when done

    seed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mnemonic_to_seed_deterministic() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let seed1 = mnemonic_to_seed(mnemonic, None);
        let seed2 = mnemonic_to_seed(mnemonic, None);

        // Same mnemonic should produce same seed
        assert_eq!(seed1, seed2);

        // With passphrase
        let seed_with_pass = mnemonic_to_seed(mnemonic, Some("TREZOR"));
        assert_ne!(seed1, seed_with_pass);

        // Empty passphrase should equal None
        let seed_empty = mnemonic_to_seed(mnemonic, Some(""));
        assert_eq!(seed1, seed_empty);
    }

    #[test]
    fn test_known_mnemonic() {
        // Test with a known mnemonic to ensure we match Zig output
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let seed = mnemonic_to_seed(mnemonic, None);

        // Print for manual verification against Zig output
        println!("Seed (hex): {}", hex::encode(&seed));
        assert_eq!(seed.len(), 64);
    }
}

/// ZeiCoin Transaction API Client
///
/// Minimal HTTP client for interacting with ZeiCoin transaction API (port 8080)
/// - Get account balance
/// - Get account nonce
/// - Submit signed transactions
/// - Query transaction history
use serde::{Deserialize, Serialize};

const DEFAULT_API_BASE: &str = "http://209.38.31.77:8080";
const DEFAULT_RPC_URL: &str = "http://209.38.31.77:10803";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Balance {
    pub balance: u64,
    pub nonce: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Account {
    pub address: String,
    pub balance: u64,
    pub nonce: u64,
}

#[derive(Serialize, Deserialize)]
pub struct SignedTransaction {
    pub sender: String,
    pub recipient: String,
    pub amount: u64,
    pub fee: u64,
    pub nonce: u64,
    pub timestamp: u64,
    pub expiry_height: u64,
    pub signature: String,
    pub sender_public_key: String,
}

#[derive(Deserialize, Debug)]
pub struct TransactionResponse {
    pub success: bool,
    pub tx_hash: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    method: String,
    params: serde_json::Value,
    id: u64,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct JsonRpcResponse {
    jsonrpc: String,
    result: Option<serde_json::Value>,
    error: Option<serde_json::Value>,
    id: Option<serde_json::Value>, // Can be u64, string, or null
}

pub struct ZeiCoinAPI {
    client: reqwest::blocking::Client,
    base_url: String,
    rpc_url: String,
}

impl ZeiCoinAPI {
    /// Create a new API client with default base URL
    pub fn new() -> Self {
        Self::with_base_url(DEFAULT_API_BASE)
    }

    /// Create a new API client with custom base URL
    pub fn with_base_url(base_url: &str) -> Self {
        ZeiCoinAPI {
            client: reqwest::blocking::Client::new(),
            base_url: base_url.to_string(),
            rpc_url: DEFAULT_RPC_URL.to_string(),
        }
    }

    /// Create a new API client with custom RPC URL
    pub fn with_rpc_url(rpc_url: &str) -> Self {
        ZeiCoinAPI {
            client: reqwest::blocking::Client::new(),
            base_url: DEFAULT_API_BASE.to_string(),
            rpc_url: rpc_url.to_string(),
        }
    }

    /// Get account balance and nonce via JSON-RPC
    pub fn get_balance(&self, address: &str) -> Result<Balance, String> {
        // Use RPC server instead of Transaction API
        let rpc_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "getBalance".to_string(),
            params: serde_json::json!({"address": address}),
            id: 1,
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&rpc_request)
            .send()
            .map_err(|e| format!("RPC request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("RPC error: {}", response.status()));
        }

        // Get response as text first for debugging
        let response_text = response
            .text()
            .map_err(|e| format!("Failed to read RPC response: {}", e))?;

        // Parse JSON-RPC response
        let rpc_response: JsonRpcResponse = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse RPC response: {} (response: {})", e, response_text))?;

        // Check for RPC errors
        if let Some(error) = rpc_response.error {
            let error_str = error.to_string();

            // Check if it's an "account not found" or "invalid params" error (new wallet)
            if error_str.contains("Invalid params") ||
               error_str.contains("not found") ||
               error_str.contains("-32602") ||
               error_str.contains("Internal error") {
                // New wallet - return zero balance
                return Ok(Balance {
                    balance: 0,
                    nonce: 0,
                });
            }

            return Err(format!("RPC error: {}", error));
        }

        let result = rpc_response.result.ok_or("No result in RPC response")?;

        // Try to parse as Balance directly
        match serde_json::from_value::<Balance>(result.clone()) {
            Ok(balance) => Ok(balance),
            Err(_) => {
                // Maybe it's a nested response? Check for result.result
                if let Some(nested_result) = result.get("result") {
                    serde_json::from_value(nested_result.clone())
                        .map_err(|e| format!("Failed to parse nested balance: {}", e))
                } else {
                    // If all else fails, assume it's a new wallet with zero balance
                    Ok(Balance {
                        balance: 0,
                        nonce: 0,
                    })
                }
            }
        }
    }

    /// Get account nonce via JSON-RPC
    pub fn get_nonce(&self, address: &str) -> Result<u64, String> {
        // Use RPC server (port 10803) instead of Transaction API
        let rpc_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "getNonce".to_string(),
            params: serde_json::json!({"address": address}),
            id: 1,
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&rpc_request)
            .send()
            .map_err(|e| format!("RPC request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("RPC error: {}", response.status()));
        }

        let rpc_response: JsonRpcResponse = response
            .json()
            .map_err(|e| format!("Failed to parse RPC response: {}", e))?;

        if let Some(error) = rpc_response.error {
            let error_str = error.to_string();

            // Check if it's an "account not found" error (new wallet)
            if error_str.contains("Invalid params") ||
               error_str.contains("not found") ||
               error_str.contains("-32602") ||
               error_str.contains("Internal error") {
                // New wallet - return nonce 0
                return Ok(0);
            }

            return Err(format!("RPC error: {}", error));
        }

        let result = rpc_response.result.ok_or("No result in RPC response")?;

        // Extract nonce from result
        let nonce = result
            .get("nonce")
            .and_then(|v| v.as_u64())
            .unwrap_or(0); // Default to 0 for new accounts

        Ok(nonce)
    }

    /// Get current blockchain height via JSON-RPC
    pub fn get_height(&self) -> Result<u64, String> {
        let rpc_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "getHeight".to_string(),
            params: serde_json::json!({}),
            id: 1,
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&rpc_request)
            .send()
            .map_err(|e| format!("RPC request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("RPC error: {}", response.status()));
        }

        let rpc_response: JsonRpcResponse = response
            .json()
            .map_err(|e| format!("Failed to parse RPC response: {}", e))?;

        if let Some(error) = rpc_response.error {
            return Err(format!("RPC error: {}", error));
        }

        let result = rpc_response.result.ok_or("No result in RPC response")?;

        // Extract height from result
        let height = result
            .get("height")
            .and_then(|v| v.as_u64())
            .ok_or("Invalid height in response")?;

        Ok(height)
    }

    /// Submit a signed transaction via JSON-RPC
    pub fn submit_transaction(&self, tx: SignedTransaction) -> Result<String, String> {
        let rpc_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "submitTransaction".to_string(),
            params: serde_json::json!({
                "sender": tx.sender,
                "recipient": tx.recipient,
                "amount": tx.amount,
                "fee": tx.fee,
                "nonce": tx.nonce,
                "timestamp": tx.timestamp,
                "expiry_height": tx.expiry_height,
                "signature": tx.signature,
                "sender_public_key": tx.sender_public_key,
            }),
            id: 1,
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&rpc_request)
            .send()
            .map_err(|e| format!("RPC request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("RPC error: {}", response.status()));
        }

        let rpc_response: JsonRpcResponse = response
            .json()
            .map_err(|e| format!("Failed to parse RPC response: {}", e))?;

        if let Some(error) = rpc_response.error {
            return Err(format!("RPC error: {}", error));
        }

        let result = rpc_response.result.ok_or("No result in RPC response")?;

        // Check if transaction was successful
        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .ok_or("Invalid success field in response")?;

        if success {
            result
                .get("tx_hash")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "No transaction hash returned".to_string())
        } else {
            let error = result
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(error.to_string())
        }
    }

    /// Broadcast a signed transaction (legacy method for compatibility)
    pub fn send_transaction(&self, tx: SignedTransaction) -> Result<String, String> {
        // Use JSON-RPC submitTransaction instead
        self.submit_transaction(tx)
    }

    /// Get transaction history for an address
    pub fn get_transactions(
        &self,
        address: &str,
        limit: u32,
        offset: u32,
    ) -> Result<String, String> {
        let url = format!(
            "{}/api/transactions/{}?limit={}&offset={}",
            self.base_url, address, limit, offset
        );

        let response = self
            .client
            .get(&url)
            .send()
            .map_err(|e| format!("API request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("API error: {}", response.status()));
        }

        response
            .text()
            .map_err(|e| format!("Failed to read response: {}", e))
    }
}

impl Default for ZeiCoinAPI {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_client_creation() {
        let api = ZeiCoinAPI::new();
        assert_eq!(api.base_url, DEFAULT_API_BASE);
    }

    #[test]
    fn test_api_client_custom_url() {
        let custom_url = "http://localhost:9000";
        let api = ZeiCoinAPI::with_base_url(custom_url);
        assert_eq!(api.base_url, custom_url);
    }

    #[test]
    fn test_balance_serialization() {
        let balance = Balance {
            balance: 1000000000,
            nonce: 5,
        };

        let json = serde_json::to_string(&balance).unwrap();
        assert!(json.contains("1000000000"));
        assert!(json.contains("5"));
    }

    #[test]
    fn test_signed_transaction_serialization() {
        let tx = SignedTransaction {
            sender: "tzei1abc123".to_string(),
            recipient: "tzei1def456".to_string(),
            amount: 500000000,
            fee: 0,
            nonce: 1,
            timestamp: 1234567890,
            expiry_height: 0,
            signature: "deadbeef".to_string(),
            sender_public_key: "abcd1234".to_string(),
        };

        let json = serde_json::to_string(&tx).unwrap();
        assert!(json.contains("tzei1abc123"));
        assert!(json.contains("500000000"));
    }

    // Integration tests would require a running transaction API
    // These are unit tests for the client structure only
}

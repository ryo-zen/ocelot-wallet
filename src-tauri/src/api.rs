// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

/// ZeiCoin Transaction API Client
///
/// Secure HTTPS client for interacting with ZeiCoin blockchain APIs
/// - Get account balance
/// - Get account nonce
/// - Submit signed transactions
/// - Query transaction history
///
/// Security: Uses HTTPS with TLS 1.3 encryption
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, USER_AGENT};
use serde::{Deserialize, Serialize};

// Production HTTPS endpoints (TLS 1.3 encrypted, Let's Encrypt certificate)
const DEFAULT_API_BASE: &str = "https://api.zei.network";
const DEFAULT_RPC_URL: &str = "https://rpc.zei.network";
const WALLET_APP_ID: &str = "com.ocelot.wallet";
const WALLET_API_VERSION: &str = "1";
const WALLET_PROTOCOL: &str = "ocelot-wallet/2026-04-17";
const WALLET_VERSION: &str = env!("CARGO_PKG_VERSION");

fn wallet_user_agent() -> String {
    format!("OcelotWallet/{WALLET_VERSION}")
}

fn wallet_commit_sha() -> &'static str {
    option_env!("OCELOT_COMMIT_SHA").unwrap_or("unknown")
}

fn wallet_build_channel() -> &'static str {
    option_env!("OCELOT_BUILD_CHANNEL").unwrap_or("local")
}

fn wallet_identity_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();

    insert_header(&mut headers, USER_AGENT, &wallet_user_agent());
    insert_static_header(&mut headers, "x-ocelot-app", WALLET_APP_ID);
    insert_static_header(&mut headers, "x-ocelot-version", WALLET_VERSION);
    insert_static_header(&mut headers, "x-ocelot-commit", wallet_commit_sha());
    insert_static_header(&mut headers, "x-ocelot-channel", wallet_build_channel());
    insert_static_header(&mut headers, "x-ocelot-protocol", WALLET_PROTOCOL);
    insert_static_header(&mut headers, "x-ocelot-api-version", WALLET_API_VERSION);

    headers
}

fn insert_static_header(headers: &mut HeaderMap, name: &'static str, value: &'static str) {
    insert_header(headers, HeaderName::from_static(name), value);
}

fn insert_header(headers: &mut HeaderMap, name: HeaderName, value: &str) {
    headers.insert(
        name,
        HeaderValue::from_str(value).expect("wallet identity header should be valid"),
    );
}

fn build_http_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .default_headers(wallet_identity_headers())
        .build()
        .unwrap_or_else(|_| {
            reqwest::blocking::Client::builder()
                .default_headers(wallet_identity_headers())
                .build()
                .expect("static wallet identity headers should be valid")
        })
}

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

#[derive(Deserialize, Debug)]
pub struct FaucetResponse {
    pub success: bool,
    pub amount: Option<String>,
    pub txid: Option<String>,
    pub error: Option<String>,
    pub retry_after_seconds: Option<u64>,
}

#[derive(Deserialize, Debug)]
struct L2MessageCreateResponse {
    success: bool,
    temp_id: Option<String>,
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
            client: build_http_client(),
            base_url: base_url.to_string(),
            rpc_url: DEFAULT_RPC_URL.to_string(),
        }
    }

    /// Create a new API client with custom RPC URL
    pub fn with_rpc_url(rpc_url: &str) -> Self {
        ZeiCoinAPI {
            client: build_http_client(),
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
        let rpc_response: JsonRpcResponse = serde_json::from_str(&response_text).map_err(|e| {
            format!(
                "Failed to parse RPC response: {} (response: {})",
                e, response_text
            )
        })?;

        // Check for RPC errors
        if let Some(error) = rpc_response.error {
            let error_str = error.to_string();

            // Check if it's an "account not found" or "invalid params" error (new wallet)
            if error_str.contains("Invalid params")
                || error_str.contains("not found")
                || error_str.contains("-32602")
                || error_str.contains("Internal error")
            {
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
            if error_str.contains("Invalid params")
                || error_str.contains("not found")
                || error_str.contains("-32602")
                || error_str.contains("Internal error")
            {
                // New wallet - return nonce 0
                return Ok(0);
            }

            return Err(format!("RPC error: {}", error));
        }

        let result = rpc_response.result.ok_or("No result in RPC response")?;

        // Extract nonce from result
        let nonce = result.get("nonce").and_then(|v| v.as_u64()).unwrap_or(0); // Default to 0 for new accounts

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

    /// Call the faucet to claim ZEI based on a game score
    pub fn call_faucet(&self, address: &str, score: u32) -> Result<FaucetResponse, String> {
        let url = format!("{}/faucet", self.base_url);

        let body = serde_json::json!({
            "address": address,
            "score": score,
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .map_err(|e| format!("Faucet request failed: {}", e))?;

        response
            .json::<FaucetResponse>()
            .map_err(|e| format!("Failed to parse faucet response: {}", e))
    }

    /// Send an L2 message linked to a transaction (create draft → pending → confirm)
    pub fn send_l2_message(
        &self,
        sender: &str,
        recipient: &str,
        message: Option<&str>,
        category: Option<&str>,
        tx_hash: &str,
    ) -> Result<(), String> {
        // Step 1: Create draft
        let create_body = serde_json::json!({
            "sender": sender,
            "recipient": recipient,
            "message": message,
            "category": category,
        });

        let create_resp = self
            .client
            .post(format!("{}/api/l2/messages", self.base_url))
            .json(&create_body)
            .send()
            .map_err(|e| format!("L2 create failed: {}", e))?;

        let created: L2MessageCreateResponse = create_resp
            .json()
            .map_err(|e| format!("L2 create parse failed: {}", e))?;

        if !created.success {
            return Err("L2 create returned success=false".to_string());
        }

        let temp_id = created.temp_id.ok_or("L2 create returned no temp_id")?;

        // Step 2: Mark pending
        self.client
            .put(format!(
                "{}/api/l2/messages/{}/pending",
                self.base_url, temp_id
            ))
            .send()
            .map_err(|e| format!("L2 pending failed: {}", e))?;

        // Step 3: Confirm with tx_hash
        let confirm_body = serde_json::json!({
            "tx_hash": tx_hash,
            "block_height": 0,
        });

        self.client
            .put(format!(
                "{}/api/l2/messages/{}/confirm",
                self.base_url, temp_id
            ))
            .json(&confirm_body)
            .send()
            .map_err(|e| format!("L2 confirm failed: {}", e))?;

        Ok(())
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
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread::{self, JoinHandle};

    fn read_request(stream: &mut TcpStream) -> String {
        let mut request = Vec::new();
        let mut buffer = [0; 1024];
        let mut header_end = None;

        while header_end.is_none() {
            let bytes_read = stream.read(&mut buffer).unwrap();
            if bytes_read == 0 {
                break;
            }

            request.extend_from_slice(&buffer[..bytes_read]);
            header_end = request
                .windows(4)
                .position(|window| window == b"\r\n\r\n")
                .map(|position| position + 4);
        }

        if let Some(header_end) = header_end {
            let content_length = {
                let headers = String::from_utf8_lossy(&request[..header_end]);
                headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        if name.eq_ignore_ascii_case("content-length") {
                            value.trim().parse::<usize>().ok()
                        } else {
                            None
                        }
                    })
                    .unwrap_or(0)
            };

            while request.len() < header_end + content_length {
                let bytes_read = stream.read(&mut buffer).unwrap();
                if bytes_read == 0 {
                    break;
                }

                request.extend_from_slice(&buffer[..bytes_read]);
            }
        }

        String::from_utf8(request).unwrap()
    }

    fn spawn_response_sequence_server(
        response_bodies: Vec<&'static str>,
    ) -> (String, JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}", listener.local_addr().unwrap());
        let handle = thread::spawn(move || {
            let mut requests = Vec::with_capacity(response_bodies.len());

            for response_body in response_bodies {
                let (mut stream, _) = listener.accept().unwrap();
                let request = read_request(&mut stream);
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    response_body.len(),
                    response_body
                );
                stream.write_all(response.as_bytes()).unwrap();
                requests.push(request);
            }

            requests
        });

        (base_url, handle)
    }

    fn request_has_header(request: &str, name: &str, value: &str) -> bool {
        request.lines().any(|line| {
            let Some((header_name, header_value)) = line.split_once(':') else {
                return false;
            };

            header_name.eq_ignore_ascii_case(name) && header_value.trim() == value
        })
    }

    fn assert_wallet_identity_headers(request: &str) {
        assert!(request_has_header(
            request,
            "user-agent",
            &wallet_user_agent()
        ));
        assert!(request_has_header(request, "x-ocelot-app", WALLET_APP_ID));
        assert!(request_has_header(
            request,
            "x-ocelot-version",
            WALLET_VERSION
        ));
        assert!(request_has_header(
            request,
            "x-ocelot-commit",
            wallet_commit_sha()
        ));
        assert!(request_has_header(
            request,
            "x-ocelot-channel",
            wallet_build_channel()
        ));
        assert!(request_has_header(
            request,
            "x-ocelot-protocol",
            WALLET_PROTOCOL
        ));
        assert!(request_has_header(
            request,
            "x-ocelot-api-version",
            WALLET_API_VERSION
        ));
    }

    fn sample_signed_transaction() -> SignedTransaction {
        SignedTransaction {
            sender: "tzei1abc123".to_string(),
            recipient: "tzei1def456".to_string(),
            amount: 500000000,
            fee: 0,
            nonce: 1,
            timestamp: 1234567890,
            expiry_height: 0,
            signature: "deadbeef".to_string(),
            sender_public_key: "abcd1234".to_string(),
        }
    }

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
    fn test_wallet_user_agent_value() {
        assert_eq!(
            wallet_user_agent(),
            format!("OcelotWallet/{}", WALLET_VERSION)
        );
    }

    #[test]
    fn test_wallet_identity_values() {
        assert_eq!(WALLET_APP_ID, "com.ocelot.wallet");
        assert_eq!(WALLET_PROTOCOL, "ocelot-wallet/2026-04-17");
        assert_eq!(WALLET_API_VERSION, "1");
        assert!(!wallet_commit_sha().is_empty());
        assert!(!wallet_build_channel().is_empty());
    }

    #[test]
    fn test_api_requests_send_wallet_identity_headers() {
        let (api_url, api_handle) = spawn_response_sequence_server(vec![
            r#"{"transactions":[]}"#,
            r#"{"success":true,"amount":"0.2","txid":"tx123"}"#,
            r#"{"success":true,"temp_id":"tmp123"}"#,
            r#"{"success":true}"#,
            r#"{"success":true}"#,
        ]);
        let api = ZeiCoinAPI::with_base_url(&api_url);

        api.get_transactions("tzei1abc123", 10, 0).unwrap();
        api.call_faucet("tzei1abc123", 100).unwrap();
        api.send_l2_message(
            "tzei1abc123",
            "tzei1def456",
            Some("hello"),
            Some("general"),
            "tx123",
        )
        .unwrap();

        let requests = api_handle.join().unwrap();
        assert_eq!(requests.len(), 5);
        for request in requests {
            assert_wallet_identity_headers(&request);
        }
    }

    #[test]
    fn test_rpc_requests_send_wallet_identity_headers() {
        let (rpc_url, rpc_handle) = spawn_response_sequence_server(vec![
            r#"{"jsonrpc":"2.0","result":{"balance":10,"nonce":1},"id":1}"#,
            r#"{"jsonrpc":"2.0","result":{"nonce":2},"id":1}"#,
            r#"{"jsonrpc":"2.0","result":{"height":123},"id":1}"#,
            r#"{"jsonrpc":"2.0","result":{"success":true,"tx_hash":"tx123"},"id":1}"#,
        ]);
        let api = ZeiCoinAPI::with_rpc_url(&rpc_url);

        assert_eq!(api.get_balance("tzei1abc123").unwrap().balance, 10);
        assert_eq!(api.get_nonce("tzei1abc123").unwrap(), 2);
        assert_eq!(api.get_height().unwrap(), 123);
        assert_eq!(
            api.submit_transaction(sample_signed_transaction()).unwrap(),
            "tx123"
        );

        let requests = rpc_handle.join().unwrap();
        assert_eq!(requests.len(), 4);
        for request in requests {
            assert_wallet_identity_headers(&request);
        }
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
        let tx = sample_signed_transaction();

        let json = serde_json::to_string(&tx).unwrap();
        assert!(json.contains("tzei1abc123"));
        assert!(json.contains("500000000"));
    }

    // Integration tests would require a running transaction API
    // These are unit tests for the client structure only
}

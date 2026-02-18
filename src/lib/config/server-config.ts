/**
 * Server API Configuration
 *
 * Configuration for connecting to remote ZeiCoin server API
 * Supports multiple server URLs with automatic fallback and user selection
 */

import { browser } from '$app/environment';

export interface ServerConfig {
  primary_url: string;
  fallback_urls: string[];
  timeout_ms: number;
  retry_attempts: number;
  retry_delay_ms: number;
}

/**
 * Get user's selected server URL from localStorage (browser only)
 */
function getUserSelectedServerUrl(): string | null {
  if (!browser) return null;

  try {
    const stored = localStorage.getItem('zeicoin_server_config');
    if (stored) {
      const config = JSON.parse(stored);

      // Handle custom server URL
      if (config.selectedServerId === 'custom' && config.customServerUrl) {
        return config.customServerUrl;
      }

      // Map server IDs to URLs (HTTPS for production security)
      const serverUrls: Record<string, string> = {
        'sydney-production': 'https://api.zei.network',
        'local-testnet': 'http://127.0.0.1:10802',
        'local-mainnet': 'http://127.0.0.1:3000'
      };

      return serverUrls[config.selectedServerId] || null;
    }
  } catch (e) {
    console.error('Failed to get user selected server:', e);
  }

  return null;
}

/**
 * Get server configuration from user selection or defaults
 */
export function getServerConfig(): ServerConfig {
  // Check if user has selected a server (browser only)
  const userSelectedUrl = getUserSelectedServerUrl();

  // Primary server URL (user selection > default)
  const primary_url = userSelectedUrl || 'https://api.zei.network';

  // No fallback URLs for now (can be added later)
  const fallback_urls: string[] = [];

  // Default configuration
  const timeout_ms = 30000;
  const retry_attempts = 3;
  const retry_delay_ms = 1000;

  return {
    primary_url,
    fallback_urls,
    timeout_ms,
    retry_attempts,
    retry_delay_ms
  };
}

/**
 * Get all server URLs (primary + fallbacks)
 */
export function getAllServerUrls(): string[] {
  const config = getServerConfig();
  return [config.primary_url, ...config.fallback_urls];
}

/**
 * Check if using local development server
 */
export function isLocalServer(): boolean {
  const config = getServerConfig();
  return config.primary_url.includes('localhost') ||
         config.primary_url.includes('127.0.0.1');
}

/**
 * Default server configuration
 */
export const defaultServerConfig: ServerConfig = {
  primary_url: 'https://api.zei.network',
  fallback_urls: [],
  timeout_ms: 30000,
  retry_attempts: 3,
  retry_delay_ms: 1000
};

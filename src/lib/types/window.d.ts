/**
 * TypeScript declarations for browser window extensions
 */

interface Window {
	/** Tauri API availability flag */
	__TAURI__?: any;

	/** Svelte framework detection */
	__SVELTE__?: any;
}

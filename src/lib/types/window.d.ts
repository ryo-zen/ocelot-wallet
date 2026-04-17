// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

/**
 * TypeScript declarations for browser window extensions
 */

interface Window {
	/** Tauri API availability flag */
	__TAURI__?: any;

	/** Svelte framework detection */
	__SVELTE__?: any;
}

<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

# Build Instructions

## Standard Build (with MCP)

For development with MCP plugin support:

```bash
# Development mode
bun tauri dev

# Production build
bun tauri build
```

## Build Without MCP Plugin

For platforms where the MCP plugin is not available (e.g., Windows without the plugin source):

```bash
# Development mode
bun tauri dev -- --no-default-features

# Production build
bun tauri build -- --no-default-features
```

Or set the feature flags in your build command:

```bash
# Only build core wallet features
cargo build --release --no-default-features

# Build with specific features
cargo build --release --features "mcp"
```

## Feature Flags

- `mcp` (default): Enables the Tauri MCP plugin for AI-assisted testing
  - **Included by default** in development builds
  - Requires `tauri-plugin-mcp` source at `../../tauri-plugin-mcp`
  - Can be disabled with `--no-default-features`

## Cross-Platform Notes

### Windows
If building on Windows without the MCP plugin source, use:
```bash
bun tauri build -- --no-default-features
```

### Linux/macOS
Standard build works if MCP plugin is available locally.

## Frontend Compatibility

The frontend code automatically detects MCP availability and gracefully degrades if not present. No frontend changes needed for either build mode.

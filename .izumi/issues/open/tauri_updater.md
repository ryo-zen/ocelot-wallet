<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

---
id: tauri_updater
key: OCELO-7
title: "Implement Tauri auto-updater"
type: Story
status: Backlog
priority: Low
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1760000000005
comments: []
created_at: 2026-04-13T00:00:00Z
updated_at: 2026-04-14T04:53:34+00:00
---

## Summary

Set up Tauri's built-in auto-updater so users always run the latest official version. Cloned wallets cannot use the official update infrastructure, and users on unofficial builds will not receive security updates.

## Acceptance Criteria

- [ ] Tauri updater plugin configured in `tauri.conf.json`
- [ ] Update endpoint hosted at `https://zeicoin.com/releases/latest` or GitHub releases
- [ ] Update check runs on app startup (non-blocking)
- [ ] User is notified of available updates with a prompt to install
- [ ] Updates are signed and verified before installation
- [ ] Update channel documented for users

## Investigation Notes - 2026-04-14

- MetaMask Desktop reference checkout (`reference/metamask`, commit `92fb331`) uses `electron-updater` with a non-blocking startup check, `autoDownload = false`, and a user prompt before downloading/installing (`packages/app/src/app/update-check.ts`). This is the best-practice UX pattern to mirror in Tauri.
- MetaMask's release docs and CI package the app through GitHub releases, require review/approval before production packaging, and use CI code-signing secrets for Windows/macOS (`docs/release.md`, `.github/workflows/package-app-prod.yml`, `packages/app/electron-builder.ci.json`).
- For Tauri v2, use `tauri-plugin-updater`, set `bundle.createUpdaterArtifacts = true`, configure `plugins.updater.pubkey` and `plugins.updater.endpoints`, add updater permissions, and check for updates from startup without blocking wallet load. Reference: `https://v2.tauri.app/plugin/updater/`.
- The official Tauri updater docs state production updater endpoints are HTTPS-only unless `dangerousInsecureTransportProtocol` is set; do not enable the insecure option for release builds. GitHub Releases can host the static `latest.json` metadata and signed updater artifacts.
- This ticket depends on release signing/key management. Do OCELO-8 planning before publishing updater metadata, because users need both signed installers and signed update bundles.

<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

---
id: binary_signing
key: OCELO-8
title: "Sign release binaries"
type: Story
status: Backlog
priority: Low
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1760000000006
comments: []
created_at: 2026-04-13T00:00:00Z
updated_at: 2026-04-14T04:53:34+00:00
---

## Summary

Sign all official release binaries and source archives. Prioritize platform signing and notarization for normal users, and publish GPG signatures as an additional manual verification path.

## Acceptance Criteria

- [ ] Windows release artifacts signed with Authenticode/Trusted Signing or equivalent production signing service
- [ ] macOS release artifacts signed with Developer ID and notarized
- [ ] Tauri updater signing key generated and public key configured for OCELO-7
- [ ] GPG signing key created and public key published at `https://zeicoin.com/pgp` for manual verification
- [ ] GitHub Actions release workflow signs all release artifacts automatically after manual production approval
- [ ] `.sig` files published alongside each release asset where applicable
- [ ] README includes verification instructions for users
- [ ] Private signing keys stored securely (not in repo or CI environment variables in plain text)

## Investigation Notes - 2026-04-14

- MetaMask Desktop reference checkout (`reference/metamask`, commit `92fb331`) prioritizes platform code signing for release builds: CI config forces macOS and Windows code signing (`packages/app/electron-builder.ci.json`), notarizes macOS builds (`packages/app/build/mac/notarize.js`), and loads signing credentials from CI secrets in `.github/workflows/package-app-prod.yml`.
- For Ocelot, GPG signatures are useful for technical users, but platform signing is the higher-impact distribution control: Windows Authenticode/Trusted Signing to reduce SmartScreen warnings, macOS Developer ID plus notarization, and signed updater bundles through Tauri's updater key.
- The private release-signing material should live in a signing service or CI secret store, not in the repo and not as plaintext build variables. Prefer a signing workflow with manual approval for production releases.
- Recommended scope update: keep GPG `.sig` files as an additional verification path, but expand this ticket to include platform signing and Tauri updater signing keys so it can support OCELO-7.

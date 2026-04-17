<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

---
id: cert_pinning
key: OCELO-4
title: Implement production endpoint TLS hardening
type: Story
status: Todo
priority: Medium
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1760000000002.0
comments: []
created_at: 2026-04-13T00:00:00Z
updated_at: 2026-04-14T04:53:34+00:00
closed_at: null
---

## Summary

Harden production wallet connections to `api.zei.network` and `rpc.zei.network` after both hosts are back online with valid public HTTPS certificates. If endpoint pinning is used for official-build enforcement, prefer host allowlisting plus SPKI/public-key pins over pinning a Let's Encrypt CA certificate.

## Background

Deferred until the self-signed cert is replaced with a valid public certificate chain. Pinning the Let's Encrypt CA was considered, but it is not enough to prove the wallet is talking only to the official Zei endpoints because other hosts can also obtain Let's Encrypt certificates.

## Acceptance Criteria

- [ ] `api.zei.network` and `rpc.zei.network` serve valid public HTTPS certificates and complete chains
- [ ] Production wallet builds only treat `api.zei.network` and `rpc.zei.network` as official endpoints; local/custom endpoints remain dev-only or explicitly unpinned
- [ ] Current and backup SPKI/public-key pins captured for both official endpoints, with a rotation process documented
- [ ] reqwest client verifies official endpoint pins without using any `danger_accept_invalid_certs` workaround
- [ ] Connection to an official hostname with an unexpected public key fails with a TLS/pinning error
- [ ] Existing tests updated to cover pinned official endpoints and local/dev test bypass behavior

## Investigation Notes - 2026-04-14

- Backend/server prerequisite: `api.zei.network` and `rpc.zei.network` were down during investigation, so the current certificate chain could not be verified. Do not implement or test pinning until both hosts are serving valid HTTPS again.
- Current wallet code already uses reqwest/rustls without a `danger_accept_invalid_certs` override in `src-tauri/src/api.rs`; there is no self-signed bypass to remove in the current file.
- The app currently allows local and custom server URLs from settings. Strict production pinning would break local development/custom endpoints unless the wallet distinguishes official production endpoints from local/dev endpoints.
- Pinning a Let's Encrypt CA/root is weaker than the ticket implies. It would not prove "only the real Zei endpoints" if the user or a cloned build points the wallet to another host with a valid Let's Encrypt certificate. If the goal is official endpoint enforcement, prefer production-only host allowlisting plus SPKI/public-key pins for `api.zei.network` and `rpc.zei.network`, with at least one backup pin for rotation.
- MetaMask Desktop reference checkout (`reference/metamask`, commit `92fb331`) did not show a production cert-pinning pattern. The transferable pattern is to rely on standard TLS plus signed releases/updaters, and only add pinning if the operational rotation process is clear.

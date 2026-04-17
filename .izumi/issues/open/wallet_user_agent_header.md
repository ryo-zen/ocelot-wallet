<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

---
id: wallet_user_agent_header
key: OCELO-3
title: Add User-Agent header to all API requests
type: Story
status: Done
priority: Medium
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1760000000001.0
comments: []
created_at: 2026-04-13T00:00:00Z
updated_at: 2026-04-14T04:38:33+00:00
closed_at: 2026-04-14T04:38:33+00:00
---

## Summary

Add a `User-Agent` header (`OcelotWallet/VERSION`) to all outbound API requests in `src-tauri/src/api.rs`. This identifies official wallet clients and creates the foundation for server-side enforcement to block unofficial or cloned wallet builds.

## Background

Certificate pinning was considered but deferred — the current self-signed cert and 90-day Let's Encrypt rotation cycle make it too high maintenance right now. The User-Agent approach is a low-risk first step that gives the server the ability to filter by client identity when ready.

## Acceptance Criteria

- [x] Add `WALLET_VERSION` constant to `api.rs`
- [x] Set `User-Agent: OcelotWallet/VERSION` as a default header on the reqwest client builder
- [x] Header is sent on all requests (balance, nonce, submit transaction, transactions, faucet, L2)
- [x] Existing tests still pass

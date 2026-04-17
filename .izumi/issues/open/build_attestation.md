<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

---
id: build_attestation
key: OCELO-6
title: "Implement build attestation and version revocation"
type: Story
status: Backlog
priority: Low
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1760000000004
comments: []
created_at: 2026-04-13T00:00:00Z
updated_at: 2026-04-14T04:53:34+00:00
---

## Summary

Server tracks a minimum supported wallet version and optional revoked versions. Wallet sends its version on every request and the server can respond with a forced upgrade notice or hard block for versions known to be unsafe.

## Acceptance Criteria

- [ ] Server maintains a minimum supported version and optional revoked-version list
- [ ] API returns `426 Upgrade Required` for revoked or below-minimum versions
- [ ] Wallet handles `426` gracefully — shows user a clear upgrade message
- [ ] Revocation can be done without a server restart (config file or database)
- [ ] Unknown newer versions are allowed unless explicitly revoked

## Investigation Notes - 2026-04-14

- OCELO-3 now sends `User-Agent: OcelotWallet/<version>`, which gives the backend the input needed for minimum-version checks or revocation responses.
- Backend work is required for this ticket: define a dynamic version policy source, enforce it on API/RPC routes that should be gated, and return `426 Upgrade Required` with a response shape the wallet can display.
- MetaMask Desktop reference checkout (`reference/metamask`, commit `92fb331`) uses a compatibility-version exchange between extension and desktop (`packages/common/src/version-check.ts`, `packages/app/src/app/version-check.ts`). That is compatibility gating, not server-side build attestation, but the simple "compatibility version" model is a better fit than a brittle per-build allowlist.
- Recommended shape for Ocelot: maintain `minimum_supported_version`, optional `revoked_versions`, and an upgrade URL. Let unknown newer versions pass unless there is a specific reason to block them, otherwise forward-compatible releases will break unnecessarily.
- This ticket should probably follow OCELO-7. A forced upgrade response is much safer once users have a signed updater path.

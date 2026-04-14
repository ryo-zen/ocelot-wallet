---
id: request_signing
key: OCELO-5
title: "Evaluate API request signing"
type: Story
status: Backlog
priority: Medium
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1760000000003
comments: []
created_at: 2026-04-13T00:00:00Z
updated_at: 2026-04-14T04:53:34+00:00
---

## Summary

Evaluate whether API requests need additional signing. Do not rely on a shared build secret baked into the wallet binary as a strong security boundary; if the backend needs proof of wallet ownership, prefer a server challenge signed by the user's wallet key.

## Acceptance Criteria

- [ ] Threat model documented before implementation, including what request signing is expected to stop
- [ ] Shared client-wide `BUILD_SECRET` approach rejected or explicitly accepted only as a weak nuisance filter
- [ ] If proof of wallet ownership is needed, use a server nonce/challenge signed by the wallet key
- [ ] If any request-signing scheme is adopted, timestamp/replay protection and backend validation are implemented server-side
- [ ] Secret/key rotation and failure-mode behavior documented

## Investigation Notes - 2026-04-14

- Recommendation: do not implement this as written without a new threat model. A shared `BUILD_SECRET` baked into a desktop client binary is extractable and should not be treated as a real secret or strong clone-prevention boundary.
- MetaMask Desktop reference checkout (`reference/metamask`, commit `92fb331`) did not show an equivalent shared HMAC build-secret scheme. Their relevant pattern is signed distribution/updater infrastructure, not per-request shared-secret authentication.
- Backend impact if this remains in scope: the server must validate signatures, timestamps, replay windows, and secret rotation. That still only filters casual clients once the secret has not leaked.
- Safer alternatives: keep OCELO-3's versioned User-Agent for observability; use signed update and binary/platform signing for official distribution; use server-side rate limits/abuse controls; and for actions that need proof of wallet ownership, use a challenge signed by the wallet's own key rather than a global client secret.

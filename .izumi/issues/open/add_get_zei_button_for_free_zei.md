---
id: add_get_zei_button_for_free_zei
key: OCELO-2
title: Add get ZEI button for free ZEI
type: Story
status: Done
priority: High
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1000.0
comments: []
created_at: 2026-03-19T07:23:22.304745262+00:00
updated_at: 2026-03-20T00:00:00Z
---

## Summary

Move the existing faucet from the Singularity game onto the main dashboard as a standalone card. Users can claim 0.2 ZEI per day. The faucet logic already exists in this repo (`singularity.svelte`, `commands.rs`, `api.rs`, `tauri-wallet-api.ts`) and in the ZeiCoin repo.

## Acceptance Criteria

- [x] Standalone "Get ZEI" card on the dashboard
- [x] Claim button sends the faucet request via the existing Tauri/API integration
- [x] Limit: 0.2 ZEI per day per user (enforced server-side)
- [x] Card displays next claim time when the user has already claimed (e.g. "Next claim available in 14 hours")
- [x] When eligible, button is active; when not eligible, button is disabled and next claim time is shown

## Notes

- Faucet logic is in `src/lib/components/singularity.svelte`, `src-tauri/src/api.rs`, `src-tauri/src/commands.rs`, and `src/lib/services/tauri-wallet-api.ts`
- Extract and reuse existing faucet code rather than rewriting

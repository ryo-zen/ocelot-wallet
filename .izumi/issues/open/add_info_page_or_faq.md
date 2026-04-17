<!--
SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
SPDX-License-Identifier: GPL-3.0-only
-->

---
id: add_info_page_or_faq
key: OCELO-1
title: Add info page or FAQ
type: Story
status: Done
priority: High
assignee: null
labels: []
sprint: null
story_points: null
due_date: null
parent_id: null
rank: 1773904965155.0
comments: []
created_at: 2026-03-19T07:22:45.155050540+00:00
updated_at: 2026-03-20T00:00:00Z
---

## Summary

Add a dedicated `/info` route targeting new users. The page should briefly explain what ZeiCoin is, what Ocelot Wallet does, and where the project currently stands.

## Acceptance Criteria

- [x] New route at `/info`
- [x] Page includes a brief explanation of ZeiCoin and Ocelot Wallet
- [x] Page states current status: testnet — funds are not real and cannot be traded
- [x] Page sets expectations: project is in active development, changes should be expected
- [x] Dashboard shows a dismissible banner with a link to `/info`
- [x] Banner is dismissed per-session (does not reappear once closed)

## Notes

- Audience: new users, non-technical
- Keep copy simple and honest about the testnet stage
- No emojis, clean prose consistent with the rest of the app's design

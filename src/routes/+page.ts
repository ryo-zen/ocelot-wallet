// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

import { redirect } from '@sveltejs/kit';

export function load() {
	redirect(302, '/login');
}

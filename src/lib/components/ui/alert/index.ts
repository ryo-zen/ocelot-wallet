// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

import Root from "./alert.svelte";
import Description from "./alert-description.svelte";
import Title from "./alert-title.svelte";
export { alertVariants, type AlertVariant } from "./alert.svelte";

export {
	Root,
	Description,
	Title,
	//
	Root as Alert,
	Description as AlertDescription,
	Title as AlertTitle,
};

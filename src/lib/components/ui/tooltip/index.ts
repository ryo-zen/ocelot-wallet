// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

import { Tooltip as TooltipPrimitive } from "bits-ui";
import Trigger from "./tooltip-trigger.svelte";
import Content from "./tooltip-content.svelte";

const Root = TooltipPrimitive.Root;
const Provider = TooltipPrimitive.Provider;
const Portal = TooltipPrimitive.Portal;

export {
	Root,
	Trigger,
	Content,
	Provider,
	Portal,
	//
	Root as Tooltip,
	Content as TooltipContent,
	Trigger as TooltipTrigger,
	Provider as TooltipProvider,
	Portal as TooltipPortal,
};

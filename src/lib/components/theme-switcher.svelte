<script lang="ts">
	import { themeStore, type Theme, type Mode } from '$lib/stores/theme.js';
	import * as Select from "$lib/components/ui/select/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import PaletteIcon from "@lucide/svelte/icons/palette";
	import SunIcon from "@lucide/svelte/icons/sun";
	import MoonIcon from "@lucide/svelte/icons/moon";

	const themeOptions = [
		{ value: 'default', label: 'Default', description: 'Original wallet design' },
		{ value: 'geist', label: 'Geist', description: 'Modern monospace design' },
		{ value: 'nature', label: 'Nature', description: 'Green natural theme' }
	];

	const modeOptions = [
		{ value: 'light', label: 'Light', description: 'Light color scheme' },
		{ value: 'dark', label: 'Dark', description: 'Dark color scheme' }
	];

	let currentTheme = $state('default');
	let currentMode = $state('light');
	
	// Subscribe to theme store and sync
	themeStore.subscribe(state => {
		currentTheme = state.theme;
		currentMode = state.mode;
	});

	// Derived trigger content
	const themeContent = $derived(
		themeOptions.find((option) => option.value === currentTheme)?.label ?? "Select theme"
	);

	const modeContent = $derived(
		modeOptions.find((option) => option.value === currentMode)?.label ?? "Select mode"
	);

	// Handle changes
	$effect(() => {
		if (currentTheme) {
			themeStore.setTheme(currentTheme as Theme);
		}
	});

	$effect(() => {
		if (currentMode) {
			themeStore.setMode(currentMode as Mode);
		}
	});
</script>

<div class="space-y-4">
	<div class="flex items-center gap-2">
		<PaletteIcon class="h-5 w-5 text-muted-foreground" />
		<h3 class="text-lg font-semibold">Theme Preferences</h3>
	</div>
	
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- Theme Selector -->
		<div class="space-y-2">
			<Label for="theme-select">
				<div class="flex items-center gap-2">
					<PaletteIcon class="h-4 w-4" />
					<span>Theme Style</span>
				</div>
			</Label>
			<Select.Root type="single" name="theme-select" bind:value={currentTheme}>
				<Select.Trigger class="w-full">
					{themeContent}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						<Select.Label>Themes</Select.Label>
						{#each themeOptions as option (option.value)}
							<Select.Item value={option.value} label={option.label}>
								<div class="flex flex-col">
									<span class="font-medium">{option.label}</span>
									<span class="text-xs text-muted-foreground">{option.description}</span>
								</div>
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>

		<!-- Mode Selector -->
		<div class="space-y-2">
			<Label for="mode-select">
				<div class="flex items-center gap-2">
					{#if currentMode === 'light'}
						<SunIcon class="h-4 w-4" />
					{:else}
						<MoonIcon class="h-4 w-4" />
					{/if}
					<span>Color Mode</span>
				</div>
			</Label>
			<Select.Root type="single" name="mode-select" bind:value={currentMode}>
				<Select.Trigger class="w-full">
					{modeContent}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						<Select.Label>Color Modes</Select.Label>
						{#each modeOptions as option (option.value)}
							<Select.Item value={option.value} label={option.label}>
								<div class="flex items-center gap-2">
									{#if option.value === 'light'}
										<SunIcon class="h-4 w-4" />
									{:else}
										<MoonIcon class="h-4 w-4" />
									{/if}
									<div class="flex flex-col">
										<span class="font-medium">{option.label}</span>
										<span class="text-xs text-muted-foreground">{option.description}</span>
									</div>
								</div>
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	</div>
	
	<div class="bg-muted rounded-lg p-3">
		<p class="text-sm text-muted-foreground">
			Theme changes are applied instantly and saved to your browser.
		</p>
	</div>
</div>
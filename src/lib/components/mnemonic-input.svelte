<script lang="ts">
	import { Label } from "$lib/components/ui/label/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	
	interface Props {
		words?: string[];
		disabled?: boolean;
	}
	
	let { words = $bindable(Array(12).fill('')), disabled = false }: Props = $props();
	
	// Make words reactive by creating a local state
	let localWords = $state(words || Array(12).fill(''));
	
	// Sync localWords back to parent when changed
	$effect(() => {
		words = localWords;
	});
	
	// Update the word value
	function handleInput(event: Event, index: number) {
		const input = event.target as HTMLInputElement;
		const value = input.value.trim();
		
		// Update the word
		localWords[index] = value;
	}
	
	// Handle key events for navigation
	function handleKeyPress(event: KeyboardEvent, index: number) {
		// Auto-focus next input on space or tab (when completing a word)
		if ((event.key === ' ' || event.key === 'Tab') && index < 11) {
			event.preventDefault();
			const nextInput = (event.target as HTMLInputElement).parentElement?.parentElement?.children[index + 1]?.querySelector('input');
			if (nextInput) {
				(nextInput as HTMLInputElement).focus();
			}
		}
	}
	
	// Handle paste event to populate all fields
	function handlePaste(event: ClipboardEvent, startIndex: number) {
		const pasteData = event.clipboardData?.getData('text') || '';
		const pasteWords = pasteData.trim().split(/\s+/);
		
		// Only process if we have 12 words
		if (pasteWords.length === 12) {
			event.preventDefault();
			
			// Update all words
			for (let i = 0; i < 12; i++) {
				localWords[i] = pasteWords[i].toLowerCase();
			}
			
			// Focus the last input
			setTimeout(() => {
				const lastInput = document.querySelector(`input[data-mnemonic-index="11"]`) as HTMLInputElement;
				if (lastInput) {
					lastInput.focus();
				}
			}, 0);
		}
	}
	
	// Handle backspace to go to previous input
	function handleKeydown(event: KeyboardEvent, index: number) {
		if (event.key === 'Backspace' && !localWords[index] && index > 0) {
			const prevInput = (event.target as HTMLInputElement).parentElement?.parentElement?.children[index - 1]?.querySelector('input');
			if (prevInput) {
				(prevInput as HTMLInputElement).focus();
			}
		}
	}
</script>

<div class="grid grid-cols-3 md:grid-cols-4 gap-3">
	{#each localWords as word, index}
		<div class="space-y-2">
			<Label class="text-xs text-muted-foreground font-medium">
				{index + 1}
			</Label>
			<Input 
				bind:value={localWords[index]}
				placeholder="word"
				{disabled}
				data-mnemonic-index={index}
				class="text-center font-mono text-sm w-full min-w-[60px]"
				oninput={(e) => handleInput(e, index)}
				onpaste={(e) => handlePaste(e, index)}
				onkeydown={(e) => handleKeydown(e, index)}
				onkeypress={(e) => handleKeyPress(e, index)}
				autocomplete="off"
				spellcheck={false}
				maxlength={15}
			/>
		</div>
	{/each}
</div>

<div class="mt-4 p-4 bg-muted rounded-lg">
	<p class="text-sm text-muted-foreground">
		<span class="font-medium">Tip:</span> You can paste all 12 words at once into any field, or enter them one by one. 
		Words will automatically advance to the next field.
	</p>
</div>
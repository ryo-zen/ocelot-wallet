<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		open?: boolean;
		onclose?: () => void;
	}

	let { open = $bindable(false), onclose }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let interval: ReturnType<typeof setInterval> | null = null;

	let body: { x: number; y: number }[] = [];
	let food = { x: 15, y: 10 };
	let dir = { x: 1, y: 0 };
	let nextDir = { x: 1, y: 0 };
	let score = $state(0);
	let gameOver = $state(false);
	let started = $state(false);

	const GRID = 20;
	const CELL = 18;
	const SIZE = GRID * CELL;

	$effect(() => {
		if (open) {
			tick().then(() => {
				draw();
				window.addEventListener('keydown', onKey);
			});
			return () => {
				window.removeEventListener('keydown', onKey);
				stop();
			};
		}
	});

	function close() {
		open = false;
		onclose?.();
	}

	function stop() {
		if (interval) { clearInterval(interval); interval = null; }
		started = false;
	}

	function start() {
		body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
		dir = { x: 1, y: 0 };
		nextDir = { x: 1, y: 0 };
		score = 0;
		gameOver = false;
		started = true;
		placeFood();
		if (interval) clearInterval(interval);
		interval = setInterval(step, 150);
	}

	function placeFood() {
		let pos: { x: number; y: number };
		do {
			pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
		} while (body.some(s => s.x === pos.x && s.y === pos.y));
		food = pos;
	}

	function step() {
		dir = { ...nextDir };
		const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };

		if (
			head.x < 0 || head.x >= GRID ||
			head.y < 0 || head.y >= GRID ||
			body.some(s => s.x === head.x && s.y === head.y)
		) {
			if (interval) { clearInterval(interval); interval = null; }
			gameOver = true;
			draw();
			return;
		}

		body = [head, ...body];
		if (head.x === food.x && head.y === food.y) {
			score += 10;
			placeFood();
		} else {
			body.pop();
		}
		draw();
	}

	function colors() {
		const s = getComputedStyle(document.documentElement);
		return {
			bg:      s.getPropertyValue('--card').trim(),
			border:  s.getPropertyValue('--border').trim(),
			primary: s.getPropertyValue('--primary').trim(),
			fg:      s.getPropertyValue('--foreground').trim(),
			muted:   s.getPropertyValue('--muted').trim(),
			accent:  s.getPropertyValue('--accent').trim(),
		};
	}

	function draw() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const c = colors();

		ctx.fillStyle = c.bg;
		ctx.fillRect(0, 0, SIZE, SIZE);

		ctx.strokeStyle = c.border;
		ctx.globalAlpha = 0.3;
		ctx.lineWidth = 0.5;
		for (let i = 0; i <= GRID; i++) {
			ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
		}
		ctx.globalAlpha = 1;

		if (started) {
			ctx.fillStyle = c.accent;
			const fx = food.x * CELL;
			const fy = food.y * CELL;
			ctx.fillRect(fx + Math.floor(CELL / 2) - 1, fy + 2, 2, CELL - 4);
			ctx.fillRect(fx + 2, fy + Math.floor(CELL / 2) - 1, CELL - 4, 2);
		}

		body.forEach((seg, i) => {
			ctx.fillStyle = i === 0 ? c.primary : c.muted;
			ctx.globalAlpha = i === 0 ? 1 : 0.85;
			ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
		});
		ctx.globalAlpha = 1;

		if (started) {
			ctx.fillStyle = c.fg;
			ctx.font = 'bold 11px monospace';
			ctx.textAlign = 'right';
			ctx.fillText(`${score}`, SIZE - 4, 14);
		}

		if (!started) {
			ctx.fillStyle = c.muted;
			ctx.globalAlpha = 0.85;
			ctx.fillRect(SIZE / 2 - 82, SIZE / 2 - 42, 164, 78);
			ctx.globalAlpha = 1;
			ctx.fillStyle = c.primary;
			ctx.font = 'bold 14px monospace';
			ctx.textAlign = 'center';
			ctx.fillText('SINGULARITY', SIZE / 2, SIZE / 2 - 15);
			ctx.fillStyle = c.fg;
			ctx.font = '11px monospace';
			ctx.fillText('Press ENTER to start', SIZE / 2, SIZE / 2 + 10);
			ctx.fillText('Arrow keys to move', SIZE / 2, SIZE / 2 + 26);
		}

		if (gameOver) {
			ctx.fillStyle = c.muted;
			ctx.globalAlpha = 0.9;
			ctx.fillRect(SIZE / 2 - 82, SIZE / 2 - 48, 164, 96);
			ctx.globalAlpha = 1;
			ctx.fillStyle = c.primary;
			ctx.font = 'bold 15px monospace';
			ctx.textAlign = 'center';
			ctx.fillText('GAME OVER', SIZE / 2, SIZE / 2 - 20);
			ctx.fillStyle = c.fg;
			ctx.font = '12px monospace';
			ctx.fillText(`Score: ${score}`, SIZE / 2, SIZE / 2 + 2);
			ctx.font = '10px monospace';
			ctx.fillText('ENTER to restart', SIZE / 2, SIZE / 2 + 22);
			ctx.fillText('ESC to exit', SIZE / 2, SIZE / 2 + 38);
		}
	}

	function onKey(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowUp':    e.preventDefault(); if (dir.y === 0) nextDir = { x: 0, y: -1 }; break;
			case 'ArrowDown':  e.preventDefault(); if (dir.y === 0) nextDir = { x: 0, y: 1 };  break;
			case 'ArrowLeft':  e.preventDefault(); if (dir.x === 0) nextDir = { x: -1, y: 0 }; break;
			case 'ArrowRight': e.preventDefault(); if (dir.x === 0) nextDir = { x: 1, y: 0 };  break;
			case 'Enter':      if (!started || gameOver) start(); break;
			case 'Escape':     close(); break;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 bg-background/90 z-50 flex items-center justify-center backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label="Singularity"
	>
		<button
			class="absolute inset-0 w-full h-full cursor-default"
			onclick={close}
			aria-label="Close"
			tabindex="-1"
		></button>

		<div class="relative z-10">
			<div class="bg-card border border-border rounded-xl p-3 shadow-2xl">
				<canvas
					bind:this={canvas}
					width={SIZE}
					height={SIZE}
					class="block rounded-lg"
				></canvas>
			</div>
		</div>
	</div>
{/if}

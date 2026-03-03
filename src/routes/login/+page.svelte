<script lang="ts">
	import LoginForm from "$lib/components/login-form.svelte";
	import OcelotLogo from "$lib/components/ocelot-logo.svelte";
</script>

<svelte:head>
	<title>Login - Ocelot Wallet</title>
</svelte:head>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href="/" class="flex items-center gap-2 font-medium">
				<OcelotLogo class="size-8 text-primary" />
				Ocelot Wallet
			</a>
		</div>
		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-xs">
				<LoginForm />
			</div>
		</div>
	</div>
	<div class="bg-muted relative hidden lg:block overflow-hidden">
		<img
			src="/login-image.jpg"
			alt="Ocelot Wallet Login"
			class="absolute inset-0 h-full w-full object-cover object-center"
		/>
		<p class="absolute bottom-3 right-3 text-[11px] text-white/50">
			Photo by <a href="https://unsplash.com/@harix" target="_blank" rel="noopener noreferrer" class="underline hover:text-white/80">Harrison Qi</a> on <a href="https://unsplash.com/" target="_blank" rel="noopener noreferrer" class="underline hover:text-white/80">Unsplash</a>
		</p>
	</div>
</div>

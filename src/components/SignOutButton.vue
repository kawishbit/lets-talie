<script setup lang="ts">
	import { signOut } from "../lib/auth-client";

	async function handleSignOut() {
		await signOut({
			fetchOptions: {
				onSuccess: () => {
					window.location.href = "/";
				},
			},
		});
	}
</script>

<template>
	<button
		type="button"
		@click="handleSignOut"
		class="px-3 py-1.5 rounded-full text-sm border border-(--color-hairline) hover:bg-(--color-surface) transition-colors cursor-pointer"
	>
		Sign out
	</button>
</template>

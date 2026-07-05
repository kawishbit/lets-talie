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
    class="px-3 py-1.5 rounded-full text-sm border border-[#e8e8e8] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
  >
    Sign out
  </button>
</template>

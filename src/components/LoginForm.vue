<script setup lang="ts">
import { ref } from "vue";
import { authClient } from "../lib/auth-client";

const email = ref("");
const loading = ref(false);
const sent = ref(false);
const error = ref("");

async function handleSubmit() {
	if (!email.value.trim()) return;
	loading.value = true;
	error.value = "";

	const result = await authClient.signIn.magicLink({
		email: email.value.trim(),
		callbackURL: "/dashboard",
	});

	loading.value = false;

	if (result.error) {
		error.value =
			result.error.message ?? "Something went wrong. Please try again.";
	} else {
		sent.value = true;
	}
}
</script>

<template>
  <div v-if="sent" class="bg-[#e4f5d4] rounded-2xl px-6 py-8 text-center">
    <p class="font-[540] text-base mb-1">Check your inbox</p>
    <p class="text-sm text-[#525252] font-[330]">
      We sent a magic link to <strong class="font-[500]">{{ email }}</strong>. It expires in 10 minutes.
    </p>
  </div>

  <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <label for="email" class="text-sm font-[500]">Email address</label>
      <input
        id="email"
        v-model="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
        :disabled="loading"
        class="w-full px-4 py-3 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors disabled:opacity-50 bg-white"
      />
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button
      type="submit"
      :disabled="loading || !email.trim()"
      class="w-full bg-[#0a0a0a] text-white py-3 rounded-full text-[15px] font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
    >
      {{ loading ? 'Sending…' : 'Send magic link' }}
    </button>
  </form>
</template>

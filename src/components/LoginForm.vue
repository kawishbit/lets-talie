<script setup lang="ts">
	import { ref } from "vue";
	import { authClient } from "../lib/auth-client";

	const email = ref("");
	const otp = ref("");
	const loading = ref(false);
	const step = ref<"email" | "otp">("email");
	const error = ref("");

	async function handleEmailSubmit() {
		if (!email.value.trim()) return;
		loading.value = true;
		error.value = "";

		const result = await authClient.passwordlessBundle.request({
			email: email.value.trim(),
			callbackURL: "/dashboard",
			errorCallbackURL: "/login?error",
		});

		loading.value = false;

		if (result.error) {
			error.value =
				result.error.message ?? "Something went wrong. Please try again.";
		} else {
			step.value = "otp";
		}
	}

	async function handleOtpSubmit() {
		if (!otp.value.trim()) return;
		loading.value = true;
		error.value = "";

		const result = await authClient.passwordlessBundle.verifyOtp({
			email: email.value.trim(),
			otp: otp.value.trim(),
		});

		loading.value = false;

		if (result.error) {
			error.value = result.error.message ?? "Invalid code. Please try again.";
		} else {
			window.location.href = "/dashboard";
		}
	}

	function handleBack() {
		step.value = "email";
		otp.value = "";
		error.value = "";
	}
</script>

<template>
	<form
		v-if="step === 'email'"
		@submit.prevent="handleEmailSubmit"
		class="flex flex-col gap-4"
	>
		<div class="flex flex-col gap-1.5">
			<label for="email" class="text-sm font-medium">Email address</label>
			<input
				id="email"
				v-model="email"
				type="email"
				autocomplete="email"
				placeholder="you@example.com"
				required
				:disabled="loading"
				class="w-full px-4 py-3 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors disabled:opacity-50 bg-input-bg"
			>
		</div>

		<p v-if="error" class="text-sm text-red-600">{{ error }}</p>

		<button
			type="submit"
			:disabled="loading || !email.trim()"
			class="w-full bg-ink text-canvas py-3 rounded-full text-[15px] font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
		>
			{{ loading ? 'Sending…' : 'Send login code' }}
		</button>
	</form>

	<form v-else @submit.prevent="handleOtpSubmit" class="flex flex-col gap-4">
		<div
			class="bg-(--color-badge-positive-bg) rounded-2xl px-6 py-5 text-center"
		>
			<p class="font-[540] text-base mb-1">Check your inbox</p>
			<p class="text-sm text-label font-[330]">
				We sent a 6-digit code and a magic link to
				<strong class="font-medium">{{ email }}</strong>.
			</p>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="otp" class="text-sm font-medium">Enter your code</label>
			<input
				id="otp"
				v-model="otp"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				placeholder="123456"
				maxlength="6"
				required
				:disabled="loading"
				class="w-full px-4 py-3 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors disabled:opacity-50 bg-input-bg tracking-[0.2em] text-center font-medium"
			>
		</div>

		<p v-if="error" class="text-sm text-red-600">{{ error }}</p>

		<button
			type="submit"
			:disabled="loading || otp.trim().length < 6"
			class="w-full bg-ink text-canvas py-3 rounded-full text-[15px] font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
		>
			{{ loading ? 'Verifying…' : 'Sign in' }}
		</button>

		<button
			type="button"
			@click="handleBack"
			class="text-sm text-label font-[330] hover:text-ink transition-colors cursor-pointer"
		>
			Use a different email
		</button>
	</form>
</template>

<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import IconX from "~icons/lucide/x";

	interface User {
		id: string;
		name: string;
		email: string;
		role: "user" | "admin";
		accountBalance: string;
		createdAt: string;
		deletedAt: string | null;
	}

	const props = defineProps<{
		editingUser: User | null;
	}>();

	const emit = defineEmits<{
		close: [];
		saved: [];
	}>();

	const name = ref("");
	const email = ref("");
	const role = ref<"user" | "admin">("user");
	const loading = ref(false);
	const error = ref("");

	watch(
		() => props.editingUser,
		(u) => {
			if (u) {
				name.value = u.name;
				email.value = u.email;
				role.value = u.role;
			} else {
				name.value = "";
				email.value = "";
				role.value = "user";
			}
			error.value = "";
		},
		{ immediate: true },
	);

	const isEditing = computed(() => !!props.editingUser);
	const canSubmit = computed(
		() =>
			name.value.trim().length > 0 &&
			email.value.trim().includes("@") &&
			!loading.value,
	);

	async function handleSubmit() {
		if (!canSubmit.value) return;
		loading.value = true;
		error.value = "";

		const body = {
			name: name.value.trim(),
			email: email.value.trim(),
			role: role.value,
		};

		try {
			let res: Response;
			let id = props.editingUser?.id ?? "";
			if (isEditing.value) {
				res = await fetch(`/api/users/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
			} else {
				res = await fetch("/api/users", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
			}

			const data = await res.json();
			if (!res.ok) {
				error.value = data.error ?? "Something went wrong.";
			} else {
				emit("saved");
			}
		} catch {
			error.value = "Network error. Please try again.";
		} finally {
			loading.value = false;
		}
	}
</script>

<template>
	<!-- Backdrop -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close modal"
			class="absolute inset-0 bg-(--color-modal-scrim) cursor-default w-full"
			@click="emit('close')"
			@keydown.esc="emit('close')"
		/>

		<!-- Modal -->
		<div
			class="relative bg-(--color-modal-bg) rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5"
		>
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h2 class="font-[540] text-base tracking-[-0.02em]">
					{{ isEditing ? "Edit user" : "Create user" }}
				</h2>
				<button
					type="button"
					@click="emit('close')"
					class="p-1.5 rounded-full hover:bg-surface transition-colors text-muted"
					aria-label="Close"
				>
					<IconX class="w-4 h-4" aria-hidden="true" />
				</button>
			</div>

			<!-- Form -->
			<form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label
						for="modal-name"
						class="text-xs font-medium uppercase tracking-wider text-label"
						>Name</label
					>
					<input
						id="modal-name"
						v-model="name"
						type="text"
						placeholder="Jane Doe"
						required
						class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
				</div>

				<div class="flex flex-col gap-1.5">
					<label
						for="modal-email"
						class="text-xs font-medium uppercase tracking-wider text-label"
						>Email</label
					>
					<input
						id="modal-email"
						v-model="email"
						type="email"
						placeholder="jane@example.com"
						required
						class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
				</div>

				<div class="flex flex-col gap-1.5">
					<label
						for="modal-role"
						class="text-xs font-medium uppercase tracking-wider text-label"
						>Role</label
					>
					<select
						id="modal-role"
						v-model="role"
						class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<p v-if="error" class="text-sm text-red-600">{{ error }}</p>

				<div class="flex gap-3 mt-1">
					<button
						type="button"
						@click="emit('close')"
						class="flex-1 border border-hairline py-2.5 rounded-full text-sm font-[480] tracking-[-0.01em] hover:bg-surface transition-colors cursor-pointer"
					>
						Cancel
					</button>
					<button
						type="submit"
						:disabled="!canSubmit"
						class="flex-1 bg-ink text-(--color-canvas) py-2.5 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
					>
						{{ loading ? (isEditing ? "Saving…" : "Creating…") : (isEditing ? "Save changes" : "Create user") }}
					</button>
				</div>
			</form>
		</div>
	</div>
</template>

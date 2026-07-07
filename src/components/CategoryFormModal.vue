<script setup lang="ts">
	import { computed, ref, watch } from "vue";

	interface Category {
		id: string;
		label: string;
		remarks: string | null;
		createdAt: string;
	}

	const props = defineProps<{
		editingCategory: Category | null;
	}>();

	const emit = defineEmits<{
		close: [];
		saved: [];
	}>();

	const label = ref("");
	const remarks = ref("");
	const loading = ref(false);
	const error = ref("");

	watch(
		() => props.editingCategory,
		(c) => {
			if (c) {
				label.value = c.label;
				remarks.value = c.remarks ?? "";
			} else {
				label.value = "";
				remarks.value = "";
			}
			error.value = "";
		},
		{ immediate: true },
	);

	const isEditing = computed(() => !!props.editingCategory);
	const canSubmit = computed(
		() => label.value.trim().length > 0 && !loading.value,
	);

	async function handleSubmit() {
		if (!canSubmit.value) return;
		loading.value = true;
		error.value = "";

		const body = {
			label: label.value.trim(),
			remarks: remarks.value.trim() || undefined,
		};

		try {
			let res: Response;
			const id = props.editingCategory?.id ?? "";
			if (isEditing.value) {
				res = await fetch(`/api/categories/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
			} else {
				res = await fetch("/api/categories", {
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
					{{ isEditing ? "Edit category" : "Create category" }}
				</h2>
				<button
					type="button"
					@click="emit('close')"
					class="p-1.5 rounded-full hover:bg-(--color-surface) transition-colors text-(--color-muted)"
					aria-label="Close"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- Form -->
			<form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label
						for="modal-label"
						class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
						>Label</label
					>
					<input
						id="modal-label"
						v-model="label"
						type="text"
						placeholder="e.g. Food & Drinks"
						required
						class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
					>
				</div>

				<div class="flex flex-col gap-1.5">
					<label
						for="modal-remarks"
						class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
						>Remarks
						<span class="normal-case font-[400] text-(--color-muted)"
							>(optional)</span
						></label
					>
					<textarea
						id="modal-remarks"
						v-model="remarks"
						placeholder="Any notes about this category…"
						rows="3"
						class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg) resize-none"
					/>
				</div>

				<p v-if="error" class="text-sm text-red-600">{{ error }}</p>

				<div class="flex justify-end gap-2 pt-1">
					<button
						type="button"
						@click="emit('close')"
						class="px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] border border-(--color-hairline) hover:bg-(--color-surface) transition-colors cursor-pointer"
					>
						Cancel
					</button>
					<button
						type="submit"
						:disabled="!canSubmit"
						class="inline-flex items-center gap-1.5 bg-(--color-ink) text-(--color-canvas) px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
					>
						<span v-if="loading">Saving…</span>
						<span v-else>{{ isEditing ? "Save changes" : "Create" }}</span>
					</button>
				</div>
			</form>
		</div>
	</div>
</template>

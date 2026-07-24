<script setup lang="ts">
	import { combineDateWithTime, toDateInputValue } from "@utils/date.ts";
	import { computed, ref, watch } from "vue";
	import IconX from "~icons/lucide/x";

	interface TransactionRow {
		id: string;
		transactionGroupId: string | null;
		name: string;
		date: string;
		remarks: string | null;
		amount: string;
		type: "deposit" | "withdrawal";
		status: "pending" | "completed" | "cancelled";
		paidByUserId: string;
		paidByUserName: string | null;
		categoryId: string | null;
		categoryLabel: string | null;
		createdAt: string;
		deletedAt: string | null;
	}

	interface UserOption {
		id: string;
		name: string;
		email: string;
	}

	interface CategoryOption {
		id: string;
		label: string;
	}

	const props = defineProps<{
		transaction: TransactionRow;
		users: UserOption[];
		categories: CategoryOption[];
	}>();

	const emit = defineEmits<{
		close: [];
		saved: [];
	}>();

	const name = ref("");
	const date = ref("");
	const remarks = ref("");
	const amount = ref<number | "">("");
	const paidByUserId = ref("");
	const type = ref<"deposit" | "withdrawal">("withdrawal");
	const status = ref<"pending" | "completed" | "cancelled">("completed");
	const categoryId = ref("");
	const loading = ref(false);
	const error = ref("");

	watch(
		() => props.transaction,
		(tx) => {
			name.value = tx.name;
			date.value = toDateInputValue(tx.date);
			remarks.value = tx.remarks ?? "";
			amount.value = parseFloat(tx.amount);
			paidByUserId.value = tx.paidByUserId;
			type.value = tx.type;
			status.value = tx.status;
			categoryId.value = tx.categoryId ?? "";
			error.value = "";
		},
		{ immediate: true },
	);

	const canSubmit = computed(
		() =>
			name.value.trim().length > 0 &&
			date.value.length > 0 &&
			amount.value !== "" &&
			Number(amount.value) > 0 &&
			paidByUserId.value.length > 0 &&
			!loading.value,
	);

	async function handleSubmit() {
		if (!canSubmit.value) return;
		loading.value = true;
		error.value = "";

		const body: Record<string, unknown> = {
			name: name.value.trim(),
			// Keep existing clock time when only the calendar day is edited
			date: combineDateWithTime(date.value, new Date(props.transaction.date)),
			amount: Number(amount.value),
			paidByUserId: paidByUserId.value,
			type: type.value,
			status: status.value,
			remarks: remarks.value.trim() || null,
			categoryId: categoryId.value || null,
		};

		try {
			const res = await fetch(`/api/transactions/${props.transaction.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
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
			class="relative bg-(--color-modal-bg) rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
		>
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h2 class="font-[540] text-base tracking-[-0.02em]">
					Edit transaction
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

			<form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label
						for="edit-tx-name"
						class="text-xs font-medium uppercase tracking-wider text-label"
						>Name</label
					>
					<input
						id="edit-tx-name"
						v-model="name"
						type="text"
						required
						class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="flex flex-col gap-1.5">
						<label
							for="edit-tx-date"
							class="text-xs font-medium uppercase tracking-wider text-label"
							>Date</label
						>
						<input
							id="edit-tx-date"
							v-model="date"
							type="date"
							required
							class="w-full min-w-0 px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
						>
					</div>
					<div class="flex flex-col gap-1.5">
						<label
							for="edit-tx-amount"
							class="text-xs font-medium uppercase tracking-wider text-label"
							>Amount</label
						>
						<input
							id="edit-tx-amount"
							v-model="amount"
							type="number"
							min="0.01"
							step="0.01"
							required
							class="w-full min-w-0 px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
						>
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<label
						for="edit-tx-user"
						class="text-xs font-medium uppercase tracking-wider text-label"
						>Paid by</label
					>
					<select
						id="edit-tx-user"
						v-model="paidByUserId"
						required
						class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
						<option value="">— Select user —</option>
						<option v-for="u in users" :key="u.id" :value="u.id">
							{{ u.name }}
						</option>
					</select>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="flex flex-col gap-1.5">
						<label
							for="edit-tx-type"
							class="text-xs font-medium uppercase tracking-wider text-label"
							>Type</label
						>
						<select
							id="edit-tx-type"
							v-model="type"
							class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
						>
							<option value="deposit">Deposit</option>
							<option value="withdrawal">Withdrawal</option>
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<label
							for="edit-tx-status"
							class="text-xs font-medium uppercase tracking-wider text-label"
							>Status</label
						>
						<select
							id="edit-tx-status"
							v-model="status"
							class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
						>
							<option value="completed">Completed</option>
							<option value="pending">Pending</option>
							<option value="cancelled">Cancelled</option>
						</select>
					</div>
				</div>

				<div v-if="categories.length > 0" class="flex flex-col gap-1.5">
					<label
						for="edit-tx-category"
						class="text-xs font-medium uppercase tracking-wider text-label"
						>Category
						<span class="normal-case font-[330]">(optional)</span></label
					>
					<select
						id="edit-tx-category"
						v-model="categoryId"
						class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
						<option value="">— No category —</option>
						<option v-for="c in categories" :key="c.id" :value="c.id">
							{{ c.label }}
						</option>
					</select>
				</div>

				<div class="flex flex-col gap-1.5">
					<label
						for="edit-tx-remarks"
						class="text-xs font-medium uppercase tracking-wider text-label"
						>Remarks
						<span class="normal-case font-[330]">(optional)</span></label
					>
					<input
						id="edit-tx-remarks"
						v-model="remarks"
						type="text"
						placeholder="Any notes…"
						class="w-full px-3 py-2.5 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
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
						{{ loading ? "Saving…" : "Save changes" }}
					</button>
				</div>
			</form>
		</div>
	</div>
</template>

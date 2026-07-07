<script setup lang="ts">
	import { computed, ref, watch } from "vue";

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
		users: UserOption[];
		categories: CategoryOption[];
		currentUserId: string;
	}>();

	const name = ref("");
	const date = ref(new Date().toISOString().split("T")[0]);
	const remarks = ref("");
	const amount = ref<number | "">("");
	const paidByUserId = ref(props.currentUserId);
	const selectedParties = ref<string[]>([props.currentUserId]);
	const categoryId = ref("");
	const useCustomAmounts = ref(false);
	const customAmounts = ref<Record<string, number | "">>({});

	const loading = ref(false);
	const success = ref(false);
	const error = ref("");

	// Keep custom amounts in sync when parties change
	watch(selectedParties, (parties) => {
		const next: Record<string, number | ""> = {};
		for (const uid of parties) {
			next[uid] = customAmounts.value[uid] ?? "";
		}
		customAmounts.value = next;
	});

	// Ensure paidBy is always in parties
	watch(paidByUserId, (uid) => {
		if (!selectedParties.value.includes(uid)) {
			selectedParties.value = [...selectedParties.value, uid];
		}
	});

	const customAmountsSum = computed(() => {
		return selectedParties.value.reduce((sum, uid) => {
			const v = customAmounts.value[uid];
			return sum + (typeof v === "number" ? v : 0);
		}, 0);
	});

	const customAmountsValid = computed(() => {
		if (!useCustomAmounts.value || !amount.value) return true;
		return Math.abs(customAmountsSum.value - Number(amount.value)) < 0.01;
	});

	const canSubmit = computed(() => {
		return (
			name.value.trim() &&
			date.value &&
			amount.value &&
			Number(amount.value) > 0 &&
			paidByUserId.value &&
			selectedParties.value.length > 0 &&
			(!useCustomAmounts.value || customAmountsValid.value)
		);
	});

	function toggleParty(uid: string) {
		// paidBy must stay in parties
		if (uid === paidByUserId.value) return;
		if (selectedParties.value.includes(uid)) {
			selectedParties.value = selectedParties.value.filter((p) => p !== uid);
		} else {
			selectedParties.value = [...selectedParties.value, uid];
		}
	}

	async function handleSubmit() {
		if (!canSubmit.value) return;
		loading.value = true;
		error.value = "";

		const body: Record<string, unknown> = {
			name: name.value.trim(),
			date: date.value,
			amount: Number(amount.value),
			paidByUserId: paidByUserId.value,
			parties: selectedParties.value,
		};
		if (remarks.value.trim()) body.remarks = remarks.value.trim();
		if (categoryId.value) body.categoryId = categoryId.value;
		if (useCustomAmounts.value) {
			const ca: Record<string, number> = {};
			for (const uid of selectedParties.value) {
				ca[uid] = Number(customAmounts.value[uid] ?? 0);
			}
			body.customAmounts = ca;
		}

		try {
			const res = await fetch("/api/transactions/group", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = await res.json();
			if (!res.ok) {
				error.value = data.error ?? "Failed to create transaction.";
			} else {
				success.value = true;
				// Reset form
				name.value = "";
				date.value = new Date().toISOString().split("T")[0];
				remarks.value = "";
				amount.value = "";
				paidByUserId.value = props.currentUserId;
				selectedParties.value = [props.currentUserId];
				categoryId.value = "";
				useCustomAmounts.value = false;
				customAmounts.value = {};
				setTimeout(() => {
					success.value = false;
					window.location.reload();
				}, 1500);
			}
		} catch {
			error.value = "Network error. Please try again.";
		} finally {
			loading.value = false;
		}
	}
</script>

<template>
	<div
		v-if="success"
		class="bg-(--color-badge-positive-bg) rounded-xl px-4 py-3 text-sm font-[500] text-center"
	>
		Transaction added! Refreshing…
	</div>

	<form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-4">
		<!-- Name -->
		<div class="flex flex-col gap-1.5">
			<label
				for="gt-name"
				class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
				>Name</label
			>
			<input
				id="gt-name"
				v-model="name"
				type="text"
				placeholder="Dinner at Sakura"
				required
				class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
			>
		</div>

		<!-- Date + Amount row -->
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label
					for="gt-date"
					class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
					>Date</label
				>
				<input
					id="gt-date"
					v-model="date"
					type="date"
					required
					class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
				>
			</div>
			<div class="flex flex-col gap-1.5">
				<label
					for="gt-amount"
					class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
					>Amount</label
				>
				<input
					id="gt-amount"
					v-model="amount"
					type="number"
					min="0.01"
					step="0.01"
					placeholder="0.00"
					required
					class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
				>
			</div>
		</div>

		<!-- Paid by -->
		<div class="flex flex-col gap-1.5">
			<label
				for="gt-paidby"
				class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
				>Paid by</label
			>
			<select
				id="gt-paidby"
				v-model="paidByUserId"
				class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
			>
				<option v-for="u in users" :key="u.id" :value="u.id">
					{{ u.name }}
				</option>
			</select>
		</div>

		<!-- Parties -->
		<div class="flex flex-col gap-1.5">
			<p
				class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
			>
				Parties
			</p>
			<div class="flex flex-wrap gap-2">
				<button
					v-for="u in users"
					:key="u.id"
					type="button"
					@click="toggleParty(u.id)"
					:disabled="u.id === paidByUserId"
					:class="[
            'px-3 py-1.5 rounded-full text-xs font-[500] border transition-colors',
            selectedParties.includes(u.id)
              ? 'bg-(--color-ink) text-(--color-canvas) border-(--color-ink)'
              : 'bg-(--color-canvas) text-(--color-ink) border-(--color-hairline) hover:border-(--color-ink)',
            u.id === paidByUserId ? 'opacity-60 cursor-default' : 'cursor-pointer',
          ]"
				>
					{{ u.name }}
				</button>
			</div>
		</div>

		<!-- Custom amounts toggle -->
		<div v-if="selectedParties.length > 1" class="flex items-center gap-2">
			<input
				id="customAmounts"
				v-model="useCustomAmounts"
				type="checkbox"
				class="w-4 h-4 rounded accent-(--color-ink) cursor-pointer"
			>
			<label for="customAmounts" class="text-xs font-[500] cursor-pointer"
				>Custom split amounts</label
			>
		</div>

		<!-- Custom amount inputs -->
		<div
			v-if="useCustomAmounts && selectedParties.length > 0"
			class="flex flex-col gap-2 p-3 bg-(--color-surface) rounded-xl"
		>
			<div
				v-for="uid in selectedParties"
				:key="uid"
				class="flex items-center justify-between gap-3"
			>
				<span class="text-sm font-[330] truncate"
					>{{ users.find(u => u.id === uid)?.name }}</span
				>
				<input
					v-model.number="customAmounts[uid]"
					type="number"
					min="0"
					step="0.01"
					placeholder="0.00"
					class="w-24 px-2 py-1.5 rounded-lg border border-(--color-hairline) text-sm text-right outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
				>
			</div>
			<p
				:class="['text-xs mt-1 text-right', customAmountsValid ? 'text-(--color-label)' : 'text-red-500']"
			>
				Sum: {{ customAmountsSum.toFixed(2) }} / {{ amount || '0.00' }}
			</p>
		</div>

		<!-- Category -->
		<div v-if="categories.length > 0" class="flex flex-col gap-1.5">
			<label
				for="gt-category"
				class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
				>Category <span class="normal-case font-[330]">(optional)</span></label
			>
			<select
				id="gt-category"
				v-model="categoryId"
				class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
			>
				<option value="">— No category —</option>
				<option v-for="c in categories" :key="c.id" :value="c.id">
					{{ c.label }}
				</option>
			</select>
		</div>

		<!-- Remarks -->
		<div class="flex flex-col gap-1.5">
			<label
				for="gt-remarks"
				class="text-xs font-[500] uppercase tracking-wider text-(--color-label)"
				>Remarks <span class="normal-case font-[330]">(optional)</span></label
			>
			<input
				id="gt-remarks"
				v-model="remarks"
				type="text"
				placeholder="Any notes…"
				class="w-full px-3 py-2.5 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
			>
		</div>

		<p v-if="error" class="text-sm text-red-600">{{ error }}</p>

		<button
			type="submit"
			:disabled="loading || !canSubmit"
			class="w-full bg-(--color-ink) text-(--color-canvas) py-2.5 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-1"
		>
			{{ loading ? 'Submitting…' : 'Add group transaction' }}
		</button>
	</form>
</template>

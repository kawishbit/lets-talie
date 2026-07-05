<script setup lang="ts">
import { computed, ref } from "vue";

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
}>();

const name = ref("");
const date = ref(new Date().toISOString().split("T")[0]);
const remarks = ref("");
const amount = ref<number | "">("");
const paidByUserId = ref("");
const type = ref<"deposit" | "withdrawal">("withdrawal");
const status = ref<"pending" | "completed" | "cancelled">("completed");
const categoryId = ref("");

const loading = ref(false);
const success = ref(false);
const error = ref("");

const canSubmit = computed(() => {
	return (
		name.value.trim() &&
		date.value &&
		amount.value &&
		Number(amount.value) > 0 &&
		paidByUserId.value
	);
});

async function handleSubmit() {
	if (!canSubmit.value) return;
	loading.value = true;
	error.value = "";

	const body: Record<string, unknown> = {
		name: name.value.trim(),
		date: date.value,
		amount: Number(amount.value),
		paidByUserId: paidByUserId.value,
		type: type.value,
		status: status.value,
	};
	if (remarks.value.trim()) body.remarks = remarks.value.trim();
	if (categoryId.value) body.categoryId = categoryId.value;

	try {
		const res = await fetch("/api/transactions/single", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (!res.ok) {
			error.value = data.error ?? "Failed to create transaction.";
		} else {
			success.value = true;
			name.value = "";
			date.value = new Date().toISOString().split("T")[0];
			remarks.value = "";
			amount.value = "";
			paidByUserId.value = "";
			type.value = "withdrawal";
			status.value = "completed";
			categoryId.value = "";
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
  <div v-if="success" class="bg-[#e4f5d4] rounded-xl px-4 py-3 text-sm font-[500] text-center">
    Transaction added! Refreshing…
  </div>

  <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-4">
    <!-- Name -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">Name</label>
      <input
        v-model="name"
        type="text"
        placeholder="Balance adjustment"
        required
        class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
      />
    </div>

    <!-- Date + Amount row -->
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">Date</label>
        <input
          v-model="date"
          type="date"
          required
          class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">Amount</label>
        <input
          v-model="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          required
          class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
        />
      </div>
    </div>

    <!-- User -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">User</label>
      <select
        v-model="paidByUserId"
        required
        class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
      >
        <option value="">— Select user —</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
      </select>
    </div>

    <!-- Type + Status row -->
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">Type</label>
        <select
          v-model="type"
          class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
        >
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">Status</label>
        <select
          v-model="status"
          class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
        >
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>

    <!-- Category -->
    <div v-if="categories.length > 0" class="flex flex-col gap-1.5">
      <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">Category <span class="normal-case font-[330]">(optional)</span></label>
      <select
        v-model="categoryId"
        class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
      >
        <option value="">— No category —</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
    </div>

    <!-- Remarks -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-[500] uppercase tracking-wider text-[#525252]">Remarks <span class="normal-case font-[330]">(optional)</span></label>
      <input
        v-model="remarks"
        type="text"
        placeholder="Any notes…"
        class="w-full px-3 py-2.5 rounded-xl border border-[#e8e8e8] text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
      />
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button
      type="submit"
      :disabled="loading || !canSubmit"
      class="w-full bg-[#0a0a0a] text-white py-2.5 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-1"
    >
      {{ loading ? 'Submitting…' : 'Add single transaction' }}
    </button>
  </form>
</template>

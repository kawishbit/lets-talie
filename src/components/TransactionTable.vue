<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
	import { useServerTable } from "../composables/useServerTable";
	import DataTable from "./DataTable.vue";

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

	interface CategoryOption {
		id: string;
		label: string;
	}

	const props = defineProps<{
		initialItems: TransactionRow[];
		initialTotal: number;
		initialPage: number;
		pageSize: number;
		isAdmin: boolean;
		categories: CategoryOption[];
	}>();

	const filterStatus = ref("");
	const filterType = ref("");
	const filterCategoryId = ref("");
	const filterDateFrom = ref("");
	const filterDateTo = ref("");
	const sortBy = ref("date");
	const sortDir = ref<"asc" | "desc">("desc");

	const { items, total, page, loading, error, totalPages, load } =
		useServerTable<TransactionRow>({
			pageSize: props.pageSize,
			initialItems: props.initialItems,
			initialTotal: props.initialTotal,
			initialPage: props.initialPage,
			fetchFn: async (p) => {
				const params = new URLSearchParams({
					page: String(p),
					pageSize: String(props.pageSize),
					sortBy: sortBy.value,
					sortDir: sortDir.value,
				});
				if (filterStatus.value) params.set("status", filterStatus.value);
				if (filterType.value) params.set("type", filterType.value);
				if (filterCategoryId.value)
					params.set("categoryId", filterCategoryId.value);
				if (filterDateFrom.value) params.set("dateFrom", filterDateFrom.value);
				if (filterDateTo.value) params.set("dateTo", filterDateTo.value);
				const res = await fetch(`/api/transactions?${params}`);
				if (!res.ok) throw new Error("Failed to fetch transactions");
				return res.json();
			},
		});

	function shortGroupId(id: string | null): string | null {
		if (!id) return null;
		return id.replace(/-/g, "").slice(0, 6).toUpperCase();
	}

	function toggleSort(col: "date" | "amount") {
		if (sortBy.value === col) {
			sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
		} else {
			sortBy.value = col;
			sortDir.value = "desc";
		}
		load(1);
	}

	function formatCurrency(val: string | number) {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: import.meta.env.PUBLIC_CURRENCY_CODE ?? "USD",
		}).format(typeof val === "string" ? parseFloat(val) : val);
	}

	function statusBadgeClass(status: string) {
		switch (status) {
			case "completed":
				return "bg-(--color-badge-completed-bg) text-(--color-badge-completed-text)";
			case "pending":
				return "bg-(--color-badge-pending-bg) text-(--color-badge-pending-text) border border-hairline";
			case "cancelled":
				return "bg-surface text-muted";
			default:
				return "bg-surface text-muted";
		}
	}

	function typeBadgeClass(type: string) {
		return type === "deposit"
			? "bg-(--color-badge-positive-bg) text-(--color-badge-positive-text)"
			: "bg-(--color-badge-negative-bg) text-(--color-badge-negative-text)";
	}
</script>

<template>
	<DataTable
		:loading="loading"
		:error="error"
		:page="page"
		:total-pages="totalPages"
		:total="total"
		:col-span="7"
		empty-text="No transactions found."
		item-label="transaction"
		@paginate="load"
	>
		<template #toolbar>
			<div class="flex flex-col sm:flex-row flex-wrap gap-2 mb-5">
				<select
					v-model="filterStatus"
					@change="load(1)"
					class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="completed">Completed</option>
					<option value="cancelled">Cancelled</option>
				</select>

				<select
					v-model="filterType"
					@change="load(1)"
					class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
				>
					<option value="">All types</option>
					<option value="deposit">Deposit</option>
					<option value="withdrawal">Withdrawal</option>
				</select>

				<select
					v-model="filterCategoryId"
					@change="load(1)"
					class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
				>
					<option value="">All categories</option>
					<option v-for="c in categories" :key="c.id" :value="c.id">
						{{ c.label }}
					</option>
				</select>

				<input
					v-model="filterDateFrom"
					@change="load(1)"
					type="date"
					placeholder="From date"
					class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
				>
				<input
					v-model="filterDateTo"
					@change="load(1)"
					type="date"
					placeholder="To date"
					class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
				>

				<button
					v-if="filterStatus || filterType || filterCategoryId || filterDateFrom || filterDateTo"
					type="button"
					@click="() => { filterStatus = ''; filterType = ''; filterCategoryId = ''; filterDateFrom = ''; filterDateTo = ''; load(1); }"
					class="px-3 py-2 rounded-xl border border-hairline text-sm text-muted hover:text-ink hover:border-ink transition-colors bg-(--color-input-bg) cursor-pointer"
				>
					Clear
				</button>
			</div>
		</template>

		<template #head>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider"
			>
				Name
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden md:table-cell cursor-pointer select-none"
				@click="toggleSort('date')"
			>
				Date
				<span class="ml-1 opacity-60"
					>{{ sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span
				>
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden xl:table-cell"
			>
				Created
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden sm:table-cell"
			>
				Status
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden lg:table-cell"
			>
				Category
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden sm:table-cell"
			>
				Type
			</th>
			<th
				class="text-right px-4 py-3 font-medium text-label text-xs uppercase tracking-wider cursor-pointer select-none"
				@click="toggleSort('amount')"
			>
				Amount
				<span class="ml-1 opacity-60"
					>{{ sortBy === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span
				>
			</th>
		</template>

		<template #body>
			<tr
				v-for="row in items"
				:key="row.id"
				:class="[
					'border-b border-hairline transition-colors',
					row.deletedAt ? 'opacity-40' : 'hover:bg-faint',
				]"
			>
				<td class="px-4 py-3">
					<div class="flex flex-col gap-0.5">
						<span>{{ row.name }}</span>
						<span
							v-if="row.transactionGroupId"
							class="font-mono text-[10px] text-muted tracking-wider"
							:title="row.transactionGroupId"
							>GRP-{{ shortGroupId(row.transactionGroupId) }}</span
						>
					</div>
				</td>
				<td class="px-4 py-3 text-muted hidden md:table-cell">
					{{ formatDate(row.date) }}
				</td>
				<td class="px-4 py-3 text-muted hidden xl:table-cell">
					{{ formatDate(row.createdAt) }}
				</td>
				<td class="px-4 py-3 hidden sm:table-cell">
					<span
						:class="['inline-block px-2 py-0.5 rounded-full text-xs font-medium', statusBadgeClass(row.status)]"
					>
						{{ row.status }}
					</span>
				</td>
				<td class="px-4 py-3 text-muted hidden lg:table-cell">
					<span v-if="row.categoryLabel">{{ row.categoryLabel }}</span>
					<span v-else class="text-subtle">—</span>
				</td>
				<td class="px-4 py-3 hidden sm:table-cell">
					<span
						:class="['inline-block px-2 py-0.5 rounded-full text-xs font-medium', typeBadgeClass(row.type)]"
					>
						{{ row.type }}
					</span>
				</td>
				<td class="px-4 py-3 text-right font-medium">
					{{ formatCurrency(row.amount) }}
				</td>
			</tr>
		</template>
	</DataTable>
</template>

<script setup lang="ts">
	import { formatDate, formatDateOnly } from "@utils/date.ts";
	import { computed, ref } from "vue";
	import IconBan from "~icons/lucide/ban";
	import IconMessageSquareText from "~icons/lucide/message-square-text";
	import IconPencil from "~icons/lucide/pencil";
	import { useServerTable } from "../composables/useServerTable";
	import DataTable from "./DataTable.vue";
	import RemarksModal from "./RemarksModal.vue";
	import TransactionFormModal from "./TransactionFormModal.vue";

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

	interface UserOption {
		id: string;
		name: string;
		email: string;
	}

	const props = defineProps<{
		initialItems: TransactionRow[];
		initialTotal: number;
		initialPage: number;
		pageSize: number;
		isAdmin: boolean;
		categories: CategoryOption[];
		users?: UserOption[];
	}>();

	const filterStatus = ref("");
	const filterType = ref("");
	const filterCategoryId = ref("");
	const filterUserId = ref("");
	const filterName = ref("");
	const filterDateFrom = ref("");
	const filterDateTo = ref("");
	const sortBy = ref("date");
	const sortDir = ref<"asc" | "desc">("desc");

	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	function onSearchInput() {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => load(1), 300);
	}

	const showModal = ref(false);
	const editingTx = ref<TransactionRow | null>(null);
	const remarksTx = ref<TransactionRow | null>(null);
	const actionLoadingId = ref<string | null>(null);

	const colSpan = computed(() => {
		if (!props.isAdmin) return 7;
		return 9; // + Paid by + Actions
	});

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
				if (filterUserId.value) params.set("userId", filterUserId.value);
				if (filterName.value.trim())
					params.set("name", filterName.value.trim());
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

	function canEdit(row: TransactionRow): boolean {
		return !row.deletedAt;
	}

	function canCancel(row: TransactionRow): boolean {
		return !row.deletedAt && row.status !== "cancelled";
	}

	function openEdit(row: TransactionRow) {
		editingTx.value = row;
		showModal.value = true;
	}

	function closeModal() {
		showModal.value = false;
		editingTx.value = null;
	}

	function openRemarks(row: TransactionRow) {
		remarksTx.value = row;
	}

	function closeRemarks() {
		remarksTx.value = null;
	}

	async function onSaved() {
		closeModal();
		await load(page.value);
	}

	async function cancelTransaction(row: TransactionRow) {
		if (
			!confirm(
				`Mark "${row.name}" as cancelled? This will recalculate balances if it was completed.`,
			)
		) {
			return;
		}
		actionLoadingId.value = row.id;
		error.value = "";
		try {
			const res = await fetch(`/api/transactions/${row.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "cancelled" }),
			});
			if (!res.ok) {
				const data = await res.json();
				error.value = data.error ?? "Failed to cancel transaction.";
				return;
			}
			await load(page.value);
		} catch {
			error.value = "Network error. Please try again.";
		} finally {
			actionLoadingId.value = null;
		}
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
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
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
		:col-span="colSpan"
		empty-text="No transactions found."
		item-label="transaction"
		@paginate="load"
	>
		<template #toolbar>
			<div class="flex flex-col sm:flex-row flex-wrap gap-2 mb-5">
				<input
					v-model="filterName"
					@input="onSearchInput"
					type="text"
					placeholder="Search by name..."
					class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
				>

				<select
					v-if="isAdmin && users?.length"
					v-model="filterUserId"
					@change="load(1)"
					class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
				>
					<option value="">All users</option>
					<option v-for="u in users" :key="u.id" :value="u.id">
						{{ u.name }}
					</option>
				</select>

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
					v-if="filterName || filterUserId || filterStatus || filterType || filterCategoryId || filterDateFrom || filterDateTo"
					type="button"
					@click="() => { filterName = ''; filterUserId = ''; filterStatus = ''; filterType = ''; filterCategoryId = ''; filterDateFrom = ''; filterDateTo = ''; load(1); }"
					class="px-3 py-2 rounded-xl border border-hairline text-sm text-muted hover:text-ink hover:border-ink transition-colors bg-(--color-input-bg) cursor-pointer"
				>
					Clear
				</button>
			</div>
		</template>

		<template #head>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Name
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer select-none"
				@click="toggleSort('date')"
			>
				Date
				<span class="ml-1 opacity-60"
					>{{ sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span
				>
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Created
			</th>
			<th
				v-if="isAdmin"
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Paid by
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Status
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Category
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Type
			</th>
			<th
				class="text-right px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer select-none"
				@click="toggleSort('amount')"
			>
				Amount
				<span class="ml-1 opacity-60"
					>{{ sortBy === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span
				>
			</th>
			<th
				v-if="isAdmin"
				class="text-right px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Actions
			</th>
		</template>

		<template #body>
			<tr
				v-for="row in items"
				:key="row.id"
				:class="[
					'border-b border-hairline transition-colors',
					row.deletedAt ? 'opacity-40' : 'hover:bg-faint',
					actionLoadingId === row.id ? 'opacity-50 pointer-events-none' : '',
				]"
			>
				<td class="px-4 py-3">
					<div class="flex flex-col gap-0.5">
						<span class="flex items-center gap-1.5 whitespace-nowrap">
							{{ row.name }}
							<button
								v-if="row.remarks"
								type="button"
								@click="openRemarks(row)"
								class="p-1 rounded-full hover:bg-surface transition-colors text-muted hover:text-ink cursor-pointer"
								title="View remarks"
							>
								<IconMessageSquareText class="w-3.5 h-3.5" aria-hidden="true" />
							</button>
						</span>
						<span
							v-if="row.transactionGroupId"
							class="font-mono text-[10px] text-muted tracking-wider"
							:title="row.transactionGroupId"
							>GRP-{{ shortGroupId(row.transactionGroupId) }}</span
						>
					</div>
				</td>
				<td class="px-4 py-3 text-muted whitespace-nowrap">
					{{ formatDateOnly(row.date) }}
				</td>
				<td class="px-4 py-3 text-muted whitespace-nowrap">
					{{ formatDate(row.createdAt) }}
				</td>
				<td v-if="isAdmin" class="px-4 py-3 whitespace-nowrap">
					{{ row.paidByUserName ?? row.paidByUserId }}
				</td>
				<td class="px-4 py-3 whitespace-nowrap">
					<span
						:class="['inline-block px-2 py-0.5 rounded-full text-xs font-medium', statusBadgeClass(row.status)]"
					>
						{{ row.status }}
					</span>
				</td>
				<td class="px-4 py-3 text-muted whitespace-nowrap">
					<span v-if="row.categoryLabel">{{ row.categoryLabel }}</span>
					<span v-else class="text-subtle">—</span>
				</td>
				<td class="px-4 py-3 whitespace-nowrap">
					<span
						:class="['inline-block px-2 py-0.5 rounded-full text-xs font-medium', typeBadgeClass(row.type)]"
					>
						{{ row.type }}
					</span>
				</td>
				<td class="px-4 py-3 text-right font-medium whitespace-nowrap">
					{{ formatCurrency(row.amount) }}
				</td>
				<td v-if="isAdmin" class="px-4 py-3">
					<div
						v-if="canEdit(row) || canCancel(row)"
						class="flex items-center justify-end gap-1"
					>
						<button
							v-if="canEdit(row)"
							type="button"
							@click="openEdit(row)"
							class="p-1.5 rounded-full hover:bg-surface transition-colors text-label hover:text-ink cursor-pointer"
							title="Edit"
						>
							<IconPencil class="w-4 h-4" aria-hidden="true" />
						</button>
						<button
							v-if="canCancel(row)"
							type="button"
							@click="cancelTransaction(row)"
							class="p-1.5 rounded-full hover:bg-error-bg transition-colors text-muted hover:text-red-600 cursor-pointer"
							title="Mark as cancelled"
						>
							<IconBan class="w-4 h-4" aria-hidden="true" />
						</button>
					</div>
					<span v-else class="text-subtle text-xs">—</span>
				</td>
			</tr>
		</template>

		<template #modals>
			<Teleport to="body">
				<TransactionFormModal
					v-if="showModal && editingTx"
					:transaction="editingTx"
					:users="users ?? []"
					:categories="categories"
					@close="closeModal"
					@saved="onSaved"
				/>
			</Teleport>
			<Teleport to="body">
				<RemarksModal
					v-if="remarksTx"
					:name="remarksTx.name"
					:remarks="remarksTx.remarks ?? ''"
					@close="closeRemarks"
				/>
			</Teleport>
		</template>
	</DataTable>
</template>

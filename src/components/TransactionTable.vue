<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { computed, ref, watch } from "vue";

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

	interface TransactionGroup {
		groupId: string | null;
		name: string;
		date: string;
		totalAmount: number;
		status: string;
		categoryLabel: string | null;
		rows: TransactionRow[];
	}

	const props = defineProps<{
		initialItems: TransactionRow[];
		initialTotal: number;
		initialPage: number;
		pageSize: number;
		isAdmin: boolean;
		categories: CategoryOption[];
	}>();

	const items = ref<TransactionRow[]>(props.initialItems);
	const total = ref(props.initialTotal);
	const page = ref(props.initialPage);
	const loading = ref(false);
	const error = ref("");

	const filterStatus = ref("");
	const filterType = ref("");
	const filterCategoryId = ref("");
	const filterDateFrom = ref("");
	const filterDateTo = ref("");
	const sortBy = ref("date");
	const sortDir = ref<"asc" | "desc">("desc");

	const totalPages = computed(() => Math.ceil(total.value / props.pageSize));

	// Group transactions
	const grouped = computed<TransactionGroup[]>(() => {
		const groups = new Map<string, TransactionGroup>();
		const singleKey = "__single__";

		for (const row of items.value) {
			const key = row.transactionGroupId ?? `${singleKey}_${row.id}`;
			if (!groups.has(key)) {
				groups.set(key, {
					groupId: row.transactionGroupId,
					name: row.name,
					date: row.date,
					totalAmount: 0,
					status: row.status,
					categoryLabel: row.categoryLabel,
					rows: [],
				});
			}
			const g = groups.get(key);
			if (!g) continue;
			g.rows.push(row);
			// Sum only withdrawal amounts for the group total (the deposit mirrors the total)
			if (row.type === "withdrawal" || !row.transactionGroupId) {
				g.totalAmount += parseFloat(row.amount);
			}
			// Use the deposit date/name for group summary
			if (row.type === "deposit" && row.transactionGroupId) {
				g.name = row.name;
				g.date = row.date;
				g.categoryLabel = row.categoryLabel;
			}
			// Group status = pending if any row is pending, cancelled if all cancelled, else completed
			const statuses = g.rows.map((r) => r.status);
			if (statuses.some((s) => s === "pending")) {
				g.status = "pending";
			} else if (statuses.every((s) => s === "cancelled")) {
				g.status = "cancelled";
			} else {
				g.status = "completed";
			}
		}

		return Array.from(groups.values());
	});

	async function fetchTransactions(p = page.value) {
		loading.value = true;
		error.value = "";
		try {
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
			const data = await res.json();
			items.value = data.items;
			total.value = data.total;
			page.value = data.page;
		} catch {
			error.value = "Failed to load transactions.";
		} finally {
			loading.value = false;
		}
	}

	function toggleSort(col: "date" | "amount") {
		if (sortBy.value === col) {
			sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
		} else {
			sortBy.value = col;
			sortDir.value = "desc";
		}
		fetchTransactions(1);
	}

	function formatCurrency(val: string | number) {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(typeof val === "string" ? parseFloat(val) : val);
	}

	function statusBadgeClass(status: string) {
		switch (status) {
			case "completed":
				return "bg-(--color-badge-completed-bg) text-(--color-badge-completed-text)";
			case "pending":
				return "bg-(--color-badge-pending-bg) text-(--color-badge-pending-text) border border-(--color-hairline)";
			case "cancelled":
				return "bg-(--color-surface) text-(--color-muted)";
			default:
				return "bg-(--color-surface) text-(--color-muted)";
		}
	}

	function typeBadgeClass(type: string) {
		return type === "deposit"
			? "bg-(--color-badge-positive-bg) text-(--color-badge-positive-text)"
			: "bg-(--color-badge-negative-bg) text-(--color-badge-negative-text)";
	}

	const expandedGroups = ref<Set<string>>(new Set());

	function toggleGroup(groupId: string | null) {
		if (!groupId) return;
		if (expandedGroups.value.has(groupId)) {
			expandedGroups.value.delete(groupId);
		} else {
			expandedGroups.value.add(groupId);
		}
	}

	function isGroupExpanded(groupId: string | null) {
		if (!groupId) return false;
		return expandedGroups.value.has(groupId);
	}

	// Auto expand all groups initially
	watch(
		grouped,
		(gs) => {
			for (const g of gs) {
				if (g.groupId && g.rows.length > 1) {
					expandedGroups.value.add(g.groupId);
				}
			}
		},
		{ immediate: true },
	);
</script>

<template>
	<!-- Filters toolbar -->
	<div class="flex flex-col sm:flex-row flex-wrap gap-2 mb-5">
		<select
			v-model="filterStatus"
			@change="fetchTransactions(1)"
			class="px-3 py-2 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
		>
			<option value="">All statuses</option>
			<option value="pending">Pending</option>
			<option value="completed">Completed</option>
			<option value="cancelled">Cancelled</option>
		</select>

		<select
			v-model="filterType"
			@change="fetchTransactions(1)"
			class="px-3 py-2 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
		>
			<option value="">All types</option>
			<option value="deposit">Deposit</option>
			<option value="withdrawal">Withdrawal</option>
		</select>

		<select
			v-model="filterCategoryId"
			@change="fetchTransactions(1)"
			class="px-3 py-2 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
		>
			<option value="">All categories</option>
			<option v-for="c in categories" :key="c.id" :value="c.id">
				{{ c.label }}
			</option>
		</select>

		<input
			v-model="filterDateFrom"
			@change="fetchTransactions(1)"
			type="date"
			placeholder="From date"
			class="px-3 py-2 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
		>
		<input
			v-model="filterDateTo"
			@change="fetchTransactions(1)"
			type="date"
			placeholder="To date"
			class="px-3 py-2 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
		>

		<button
			v-if="filterStatus || filterType || filterCategoryId || filterDateFrom || filterDateTo"
			type="button"
			@click="() => { filterStatus = ''; filterType = ''; filterCategoryId = ''; filterDateFrom = ''; filterDateTo = ''; fetchTransactions(1); }"
			class="px-3 py-2 rounded-xl border border-(--color-hairline) text-sm text-(--color-muted) hover:text-(--color-ink) hover:border-(--color-ink) transition-colors bg-(--color-input-bg) cursor-pointer"
		>
			Clear
		</button>
	</div>

	<p v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</p>

	<!-- Table -->
	<div class="border border-(--color-hairline) rounded-2xl overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-(--color-hairline) bg-(--color-surface)">
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider"
						>
							Name
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden md:table-cell cursor-pointer select-none"
							@click="toggleSort('date')"
						>
							Date
							<span class="ml-1 opacity-60"
								>{{ sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span
							>
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden sm:table-cell"
						>
							Status
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden lg:table-cell"
						>
							Category
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden sm:table-cell"
						>
							Type
						</th>
						<th
							class="text-right px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider cursor-pointer select-none"
							@click="toggleSort('amount')"
						>
							Amount
							<span class="ml-1 opacity-60"
								>{{ sortBy === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span
							>
						</th>
					</tr>
				</thead>
				<tbody :class="{ 'opacity-50 pointer-events-none': loading }">
					<template v-if="grouped.length === 0">
						<tr>
							<td
								colspan="6"
								class="px-4 py-10 text-center text-sm text-(--color-muted)"
							>
								No transactions found.
							</td>
						</tr>
					</template>

					<template
						v-for="group in grouped"
						:key="group.groupId ?? group.rows[0]?.id"
					>
						<!-- Group row (or single tx row) -->
						<tr
							:class="[
                'border-b border-(--color-hairline) transition-colors',
                group.rows[0]?.deletedAt ? 'opacity-40' : 'hover:bg-(--color-faint)',
                group.groupId && group.rows.length > 1 ? 'cursor-pointer' : '',
              ]"
							@click="group.groupId && group.rows.length > 1 ? toggleGroup(group.groupId) : undefined"
						>
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<!-- Expand toggle for groups -->
									<button
										v-if="group.groupId && group.rows.length > 1"
										type="button"
										class="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-(--color-muted) hover:bg-(--color-hairline) transition-colors cursor-pointer"
										:aria-label="group.groupId && isGroupExpanded(group.groupId) ? 'Collapse group' : 'Expand group'"
										@click.stop="group.groupId ? toggleGroup(group.groupId) : undefined"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="w-3 h-3 transition-transform"
											:class="{ 'rotate-90': group.groupId && isGroupExpanded(group.groupId) }"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<polyline points="9 18 15 12 9 6" />
										</svg>
									</button>
									<span :class="group.groupId ? 'font-[500]' : ''"
										>{{ group.name }}</span
									>
									<!-- Group badge -->
									<span
										v-if="group.groupId"
										class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-[500] uppercase tracking-wider bg-(--color-surface) text-(--color-muted)"
										>Group</span
									>
								</div>
							</td>
							<td class="px-4 py-3 text-(--color-muted) hidden md:table-cell">
								{{ formatDate(group.date) }}
							</td>
							<td class="px-4 py-3 hidden sm:table-cell">
								<span
									:class="['inline-block px-2 py-0.5 rounded-full text-xs font-[500]', statusBadgeClass(group.status)]"
								>
									{{ group.status }}
								</span>
							</td>
							<td class="px-4 py-3 text-(--color-muted) hidden lg:table-cell">
								<span v-if="group.categoryLabel"
									>{{ group.categoryLabel }}</span
								>
								<span v-else class="text-(--color-subtle)">—</span>
							</td>
							<td class="px-4 py-3 hidden sm:table-cell">
								<span
									v-if="!group.groupId"
									:class="['inline-block px-2 py-0.5 rounded-full text-xs font-[500]', typeBadgeClass(group.rows[0]?.type)]"
								>
									{{ group.rows[0]?.type }}
								</span>
								<span v-else class="text-(--color-subtle) text-xs">split</span>
							</td>
							<td class="px-4 py-3 text-right font-[500]">
								{{ formatCurrency(group.totalAmount) }}
							</td>
						</tr>

						<!-- Expanded group detail rows -->
						<template v-if="group.groupId && isGroupExpanded(group.groupId)">
							<tr
								v-for="row in group.rows"
								:key="row.id"
								:class="[
                  'border-b border-(--color-hairline) last:border-0 bg-(--color-faint) transition-colors',
                  row.deletedAt ? 'opacity-40' : '',
                ]"
							>
								<td class="pl-12 pr-4 py-2.5 text-(--color-label)">
									<div class="flex items-center gap-2">
										<span
											:class="['inline-block px-1.5 py-0.5 rounded text-[10px] font-[500] uppercase tracking-wider', typeBadgeClass(row.type)]"
										>
											{{ row.type }}
										</span>
										<span class="text-sm"
											>{{ row.paidByUserName ?? row.paidByUserId }}</span
										>
									</div>
								</td>
								<td
									class="px-4 py-2.5 text-(--color-muted) hidden md:table-cell text-xs"
								></td>
								<td class="px-4 py-2.5 hidden sm:table-cell">
									<span
										:class="['inline-block px-2 py-0.5 rounded-full text-xs font-[500]', statusBadgeClass(row.status)]"
									>
										{{ row.status }}
									</span>
								</td>
								<td class="px-4 py-2.5 hidden lg:table-cell"></td>
								<td class="px-4 py-2.5 hidden sm:table-cell"></td>
								<td class="px-4 py-2.5 text-right text-(--color-label)">
									{{ formatCurrency(row.amount) }}
								</td>
							</tr>
						</template>
					</template>
				</tbody>
			</table>
		</div>
	</div>

	<!-- Pagination -->
	<div v-if="totalPages > 1" class="flex items-center justify-between mt-5">
		<p class="text-sm text-(--color-muted)">
			{{ total }}
			transaction{{ total === 1 ? '' : 's' }}
			total
		</p>
		<div class="flex items-center gap-1">
			<button
				type="button"
				:disabled="page <= 1 || loading"
				@click="fetchTransactions(page - 1)"
				class="px-3 py-1.5 rounded-full text-sm border border-(--color-hairline) disabled:opacity-40 hover:not-disabled:bg-(--color-surface) transition-colors cursor-pointer disabled:cursor-default"
			>
				←
			</button>
			<span class="px-3 py-1.5 text-sm text-(--color-muted)">
				{{ page }}
				/ {{ totalPages }}
			</span>
			<button
				type="button"
				:disabled="page >= totalPages || loading"
				@click="fetchTransactions(page + 1)"
				class="px-3 py-1.5 rounded-full text-sm border border-(--color-hairline) disabled:opacity-40 hover:not-disabled:bg-(--color-surface) transition-colors cursor-pointer disabled:cursor-default"
			>
				→
			</button>
		</div>
	</div>
	<p v-else class="text-sm text-(--color-muted) mt-5">
		{{ total }}
		transaction{{ total === 1 ? '' : 's' }}
		total
	</p>
</template>

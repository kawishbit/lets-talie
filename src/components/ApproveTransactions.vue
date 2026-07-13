<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
	import IconCheck from "~icons/lucide/check";
	import IconX from "~icons/lucide/x";
	import { useServerTable } from "../composables/useServerTable";

	interface PendingGroup {
		groupId: string;
		name: string;
		date: string;
		totalAmount: string;
		paidByUserName: string | null;
		paidByUserId: string;
		parties: { userId: string; userName: string | null; amount: string }[];
		categoryLabel: string | null;
		createdAt: string;
	}

	const props = defineProps<{
		initialGroups: PendingGroup[];
		initialTotal: number;
		initialPage: number;
		pageSize: number;
	}>();

	const loadingGroupId = ref<string | null>(null);

	const {
		items: groups,
		total,
		page,
		loading,
		error,
		totalPages,
		load,
	} = useServerTable<PendingGroup>({
		pageSize: props.pageSize,
		initialItems: props.initialGroups,
		initialTotal: props.initialTotal,
		initialPage: props.initialPage,
		fetchFn: async (p) => {
			const params = new URLSearchParams({
				page: String(p),
				pageSize: String(props.pageSize),
				status: "pending",
			});
			const res = await fetch(`/api/transactions/groups/pending?${params}`);
			if (!res.ok) throw new Error("Failed to fetch groups");
			const data = await res.json();
			return { items: data.groups, total: data.total, page: data.page };
		},
	});

	const currencyCode = import.meta.env.PUBLIC_CURRENCY_CODE ?? "USD";

	function formatCurrency(val: string | number) {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currencyCode,
		}).format(typeof val === "string" ? parseFloat(val) : val);
	}

	async function handleAction(groupId: string, action: "approve" | "reject") {
		const label = action === "approve" ? "Approve" : "Reject";
		if (!confirm(`${label} this transaction group?`)) return;

		loadingGroupId.value = groupId;
		error.value = "";
		try {
			const res = await fetch(`/api/transactions/group/${groupId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});
			if (!res.ok) {
				const data = await res.json();
				error.value = data.error ?? `Failed to ${action} group.`;
				return;
			}
			// Remove from local list
			groups.value = groups.value.filter((g) => g.groupId !== groupId);
			total.value = Math.max(0, total.value - 1);
		} catch {
			error.value = "Network error. Please try again.";
		} finally {
			loadingGroupId.value = null;
		}
	}
</script>

<template>
	<p v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</p>

	<div
		v-if="groups.length === 0"
		class="border border-hairline rounded-2xl px-6 py-14 text-center"
	>
		<p class="text-sm text-muted">No pending transactions to review.</p>
	</div>

	<div v-else class="flex flex-col gap-4">
		<div
			v-for="group in groups"
			:key="group.groupId"
			:class="[
        'border border-hairline rounded-2xl p-5 transition-opacity',
        loadingGroupId === group.groupId ? 'opacity-50 pointer-events-none' : '',
      ]"
		>
			<!-- Group header -->
			<div
				class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4"
			>
				<div>
					<p class="font-medium text-base tracking-[-0.01em]">
						{{ group.name }}
					</p>
					<p class="text-xs text-muted mt-0.5 font-mono">
						{{ formatDate(group.date) }}
					</p>
				</div>
				<div class="text-right shrink-0">
					<p class="text-xl font-medium tracking-[-0.02em]">
						{{ formatCurrency(group.totalAmount) }}
					</p>
					<p class="text-xs text-muted mt-0.5">total</p>
				</div>
			</div>

			<!-- Details row -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
				<div>
					<p
						class="font-mono text-[10px] uppercase tracking-wider text-subtle mb-1"
					>
						Paid by
					</p>
					<p class="font-[450]">
						{{ group.paidByUserName ?? group.paidByUserId }}
					</p>
				</div>
				<div>
					<p
						class="font-mono text-[10px] uppercase tracking-wider text-subtle mb-1"
					>
						Category
					</p>
					<p>{{ group.categoryLabel ?? '—' }}</p>
				</div>
				<div>
					<p
						class="font-mono text-[10px] uppercase tracking-wider text-subtle mb-1"
					>
						Submitted
					</p>
					<p class="text-muted">{{ formatDate(group.createdAt) }}</p>
				</div>
			</div>

			<!-- Parties breakdown -->
			<div class="bg-surface rounded-xl px-4 py-3 mb-4">
				<p
					class="font-mono text-[10px] uppercase tracking-wider text-subtle mb-2"
				>
					Parties
				</p>
				<div class="flex flex-wrap gap-2">
					<div
						v-for="party in group.parties"
						:key="party.userId"
						class="inline-flex items-center gap-1.5 bg-(--color-canvas) border border-hairline rounded-full px-3 py-1 text-xs"
					>
						<span class="font-[450]">{{ party.userName ?? party.userId }}</span>
						<span class="text-muted">{{ formatCurrency(party.amount) }}</span>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					@click="handleAction(group.groupId, 'approve')"
					class="inline-flex items-center gap-1.5 bg-ink text-(--color-canvas) px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity cursor-pointer"
				>
					<IconCheck class="w-4 h-4" aria-hidden="true" />
					Approve
				</button>
				<button
					type="button"
					@click="handleAction(group.groupId, 'reject')"
					class="inline-flex items-center gap-1.5 border border-hairline text-muted px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] hover:border-red-300 hover:text-red-600 transition-colors cursor-pointer"
				>
					<IconX class="w-4 h-4" aria-hidden="true" />
					Reject
				</button>
			</div>
		</div>
	</div>

	<!-- Pagination -->
	<div v-if="totalPages > 1" class="flex items-center justify-between mt-6">
		<p class="text-sm text-muted">
			{{ total }}&nbsp; pending group{{ total === 1 ? '' : 's' }}
		</p>
		<div class="flex items-center gap-1">
			<button
				type="button"
				:disabled="page <= 1 || loading"
				@click="load(page - 1)"
				class="px-3 py-1.5 rounded-full text-sm border border-hairline disabled:opacity-40 hover:not-disabled:bg-surface transition-colors cursor-pointer disabled:cursor-default"
			>
				←
			</button>
			<span class="px-3 py-1.5 text-sm text-muted"
				>{{ page }}&nbsp;/&nbsp;{{ totalPages }}</span
			>
			<button
				type="button"
				:disabled="page >= totalPages || loading"
				@click="load(page + 1)"
				class="px-3 py-1.5 rounded-full text-sm border border-hairline disabled:opacity-40 hover:not-disabled:bg-surface transition-colors cursor-pointer disabled:cursor-default"
			>
				→
			</button>
		</div>
	</div>
</template>

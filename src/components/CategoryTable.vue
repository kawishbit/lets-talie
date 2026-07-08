<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
	import { useServerTable } from "../composables/useServerTable";
	import CategoryFormModal from "./CategoryFormModal.vue";
	import DataTable from "./DataTable.vue";

	interface Category {
		id: string;
		label: string;
		remarks: string | null;
		createdAt: string;
	}

	const props = defineProps<{
		initialCategories: Category[];
		initialTotal: number;
		initialPage: number;
		pageSize: number;
	}>();

	const showModal = ref(false);
	const editingCategory = ref<Category | null>(null);

	const {
		items: categories,
		total,
		page,
		loading,
		error,
		totalPages,
		load,
	} = useServerTable<Category>({
		pageSize: props.pageSize,
		initialItems: props.initialCategories,
		initialTotal: props.initialTotal,
		initialPage: props.initialPage,
		fetchFn: async (p) => {
			const params = new URLSearchParams({
				page: String(p),
				pageSize: String(props.pageSize),
			});
			const res = await fetch(`/api/categories?${params}`);
			if (!res.ok) throw new Error("Failed to fetch categories");
			return res.json();
		},
	});

	function openCreate() {
		editingCategory.value = null;
		showModal.value = true;
	}

	function openEdit(c: Category) {
		editingCategory.value = c;
		showModal.value = true;
	}

	function closeModal() {
		showModal.value = false;
		editingCategory.value = null;
	}

	async function onSaved() {
		closeModal();
		await load(page.value);
	}

	async function deleteCategory(c: Category) {
		if (!confirm(`Delete "${c.label}"? This cannot be undone.`)) return;
		try {
			const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
			if (!res.ok) {
				const data = await res.json();
				alert(data.error ?? "Failed to delete category.");
				return;
			}
			await load(page.value);
		} catch {
			alert("Network error. Please try again.");
		}
	}
</script>

<template>
	<DataTable
		:loading="loading"
		:error="error"
		:page="page"
		:total-pages="totalPages"
		:total="total"
		:col-span="4"
		empty-text="No categories yet."
		item-label="category"
		@paginate="load"
	>
		<template #toolbar>
			<div class="flex items-center justify-end mb-6">
				<button
					type="button"
					@click="openCreate"
					class="inline-flex items-center gap-1.5 bg-ink text-(--color-canvas) px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity cursor-pointer"
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
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					Add category
				</button>
			</div>
		</template>

		<template #head>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider"
			>
				Label
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden sm:table-cell"
			>
				Remarks
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden md:table-cell"
			>
				Created
			</th>
			<th class="px-4 py-3" />
		</template>

		<template #body>
			<tr
				v-for="c in categories"
				:key="c.id"
				class="border-b border-hairline last:border-0 hover:bg-faint transition-colors"
			>
				<td class="px-4 py-3 font-[450]">{{ c.label }}</td>
				<td class="px-4 py-3 text-label hidden sm:table-cell max-w-xs truncate">
					<span v-if="c.remarks">{{ c.remarks }}</span>
					<span v-else class="text-subtle">—</span>
				</td>
				<td class="px-4 py-3 text-muted hidden md:table-cell">
					{{ formatDate(c.createdAt) }}
				</td>
				<td class="px-4 py-3">
					<div class="flex items-center justify-end gap-1">
						<button
							type="button"
							@click="openEdit(c)"
							class="p-1.5 rounded-full hover:bg-surface transition-colors text-label hover:text-ink cursor-pointer"
							title="Edit"
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
								<path
									d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
								/>
								<path
									d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
								/>
							</svg>
						</button>
						<button
							type="button"
							@click="deleteCategory(c)"
							class="p-1.5 rounded-full hover:bg-error-bg transition-colors text-muted hover:text-red-600 cursor-pointer"
							title="Delete"
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
								<polyline points="3 6 5 6 21 6" />
								<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
								<path d="M10 11v6" />
								<path d="M14 11v6" />
								<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
							</svg>
						</button>
					</div>
				</td>
			</tr>
		</template>

		<template #modals>
			<CategoryFormModal
				v-if="showModal"
				:editing-category="editingCategory"
				@close="closeModal"
				@saved="onSaved"
			/>
		</template>
	</DataTable>
</template>

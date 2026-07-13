<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
	import IconPencil from "~icons/lucide/pencil";
	import IconPlus from "~icons/lucide/plus";
	import IconTrash2 from "~icons/lucide/trash-2";
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
					<IconPlus class="w-4 h-4" aria-hidden="true" />
					Add category
				</button>
			</div>
		</template>

		<template #head>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Label
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Remarks
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
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
				<td class="px-4 py-3 font-[450] whitespace-nowrap">{{ c.label }}</td>
				<td class="px-4 py-3 text-label max-w-xs truncate">
					<span v-if="c.remarks">{{ c.remarks }}</span>
					<span v-else class="text-subtle">—</span>
				</td>
				<td class="px-4 py-3 text-muted whitespace-nowrap">
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
							<IconPencil class="w-4 h-4" aria-hidden="true" />
						</button>
						<button
							type="button"
							@click="deleteCategory(c)"
							class="p-1.5 rounded-full hover:bg-error-bg transition-colors text-muted hover:text-red-600 cursor-pointer"
							title="Delete"
						>
							<IconTrash2 class="w-4 h-4" aria-hidden="true" />
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

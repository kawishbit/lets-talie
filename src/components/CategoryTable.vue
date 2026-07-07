<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
	import CategoryFormModal from "./CategoryFormModal.vue";

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

	const categories = ref<Category[]>(props.initialCategories);
	const total = ref(props.initialTotal);
	const page = ref(props.initialPage);
	const loading = ref(false);
	const error = ref("");

	const showModal = ref(false);
	const editingCategory = ref<Category | null>(null);

	const totalPages = ref(Math.ceil(props.initialTotal / props.pageSize));

	async function fetchCategories(p = page.value) {
		loading.value = true;
		error.value = "";
		try {
			const params = new URLSearchParams({
				page: String(p),
				pageSize: String(props.pageSize),
			});
			const res = await fetch(`/api/categories?${params}`);
			if (!res.ok) throw new Error("Failed to fetch categories");
			const data = await res.json();
			categories.value = data.items;
			total.value = data.total;
			page.value = data.page;
			totalPages.value = Math.ceil(data.total / props.pageSize);
		} catch {
			error.value = "Failed to load categories.";
		} finally {
			loading.value = false;
		}
	}

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
		await fetchCategories(page.value);
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
			await fetchCategories(page.value);
		} catch {
			alert("Network error. Please try again.");
		}
	}
</script>

<template>
	<!-- Toolbar -->
	<div class="flex items-center justify-end mb-6">
		<button
			type="button"
			@click="openCreate"
			class="inline-flex items-center gap-1.5 bg-(--color-ink) text-(--color-canvas) px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity cursor-pointer"
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
							Label
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden sm:table-cell"
						>
							Remarks
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden md:table-cell"
						>
							Created
						</th>
						<th class="px-4 py-3" />
					</tr>
				</thead>
				<tbody :class="{ 'opacity-50 pointer-events-none': loading }">
					<tr v-if="categories.length === 0">
						<td
							colspan="4"
							class="px-4 py-10 text-center text-sm text-(--color-muted)"
						>
							No categories yet.
						</td>
					</tr>
					<tr
						v-for="c in categories"
						:key="c.id"
						class="border-b border-(--color-hairline) last:border-0 hover:bg-(--color-faint) transition-colors"
					>
						<td class="px-4 py-3 font-[450]">{{ c.label }}</td>
						<td
							class="px-4 py-3 text-(--color-label) hidden sm:table-cell max-w-xs truncate"
						>
							<span v-if="c.remarks">{{ c.remarks }}</span>
							<span v-else class="text-(--color-subtle)">—</span>
						</td>
						<td class="px-4 py-3 text-(--color-muted) hidden md:table-cell">
							{{ formatDate(c.createdAt) }}
						</td>
						<td class="px-4 py-3">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									@click="openEdit(c)"
									class="p-1.5 rounded-full hover:bg-(--color-surface) transition-colors text-(--color-label) hover:text-(--color-ink) cursor-pointer"
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
									class="p-1.5 rounded-full hover:bg-(--color-error-bg) transition-colors text-(--color-muted) hover:text-red-600 cursor-pointer"
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
				</tbody>
			</table>
		</div>
	</div>

	<!-- Pagination -->
	<div
		v-if="totalPages > 1"
		class="flex items-center justify-between mt-4 text-sm text-(--color-label)"
	>
		<span>Page {{ page }} of {{ totalPages }}</span>
		<div class="flex items-center gap-1">
			<button
				type="button"
				:disabled="page <= 1 || loading"
				@click="fetchCategories(page - 1)"
				class="px-3 py-1.5 rounded-full border border-(--color-hairline) text-sm font-[480] hover:bg-(--color-surface) transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
			>
				Prev
			</button>
			<button
				type="button"
				:disabled="page >= totalPages || loading"
				@click="fetchCategories(page + 1)"
				class="px-3 py-1.5 rounded-full border border-(--color-hairline) text-sm font-[480] hover:bg-(--color-surface) transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
			>
				Next
			</button>
		</div>
	</div>

	<!-- Modal -->
	<CategoryFormModal
		v-if="showModal"
		:editing-category="editingCategory"
		@close="closeModal"
		@saved="onSaved"
	/>
</template>

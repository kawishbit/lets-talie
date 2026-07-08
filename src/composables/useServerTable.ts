import type { Ref } from "vue";
import { computed, ref } from "vue";

export interface TableFetchResult<T> {
	items: T[];
	total: number;
	page: number;
}

export function useServerTable<T>(options: {
	pageSize: number;
	initialItems: T[];
	initialTotal: number;
	initialPage: number;
	fetchFn: (page: number) => Promise<TableFetchResult<T>>;
}) {
	const items = ref(options.initialItems) as Ref<T[]>;
	const total = ref(options.initialTotal);
	const page = ref(options.initialPage);
	const loading = ref(false);
	const error = ref("");
	const totalPages = computed(() => Math.ceil(total.value / options.pageSize));

	async function load(p = page.value) {
		loading.value = true;
		error.value = "";
		try {
			const data = await options.fetchFn(p);
			items.value = data.items;
			total.value = data.total;
			page.value = data.page;
		} catch {
			error.value = "Failed to load data.";
		} finally {
			loading.value = false;
		}
	}

	return { items, total, page, loading, error, totalPages, load };
}

<script setup lang="ts">
	defineProps<{
		loading: boolean;
		error: string;
		page: number;
		totalPages: number;
		total: number;
		colSpan: number;
		emptyText?: string;
		itemLabel?: string;
	}>();

	const emit = defineEmits<{
		paginate: [page: number];
	}>();
</script>

<template>
	<slot name="toolbar" />

	<p v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</p>

	<div class="border border-hairline rounded-2xl overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-hairline bg-surface">
						<slot name="head" />
					</tr>
				</thead>
				<tbody :class="{ 'opacity-50 pointer-events-none': loading }">
					<slot name="body" />
					<tr v-if="total === 0 && !loading">
						<td
							:colspan="colSpan"
							class="px-4 py-10 text-center text-sm text-muted"
						>
							{{ emptyText ?? 'No items found.' }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>

	<div v-if="totalPages > 1" class="flex items-center justify-between mt-5">
		<p class="text-sm text-muted">
			{{ total }}
			{{ itemLabel ?? 'item' }}{{ total === 1 ? '' : 's' }}
			total
		</p>
		<div class="flex items-center gap-1">
			<button
				type="button"
				:disabled="page <= 1 || loading"
				@click="emit('paginate', page - 1)"
				class="px-3 py-1.5 rounded-full text-sm border border-hairline disabled:opacity-40 hover:not-disabled:bg-surface transition-colors cursor-pointer disabled:cursor-default"
			>
				←
			</button>
			<span class="px-3 py-1.5 text-sm text-muted"
				>{{ page }}
				/ {{ totalPages }}</span
			>
			<button
				type="button"
				:disabled="page >= totalPages || loading"
				@click="emit('paginate', page + 1)"
				class="px-3 py-1.5 rounded-full text-sm border border-hairline disabled:opacity-40 hover:not-disabled:bg-surface transition-colors cursor-pointer disabled:cursor-default"
			>
				→
			</button>
		</div>
	</div>
	<p v-else class="text-sm text-muted mt-5">
		{{ total }}
		{{ itemLabel ?? 'item' }}{{ total === 1 ? '' : 's' }}
		total
	</p>

	<slot name="modals" />
</template>

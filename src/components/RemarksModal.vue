<script setup lang="ts">
	import IconX from "~icons/lucide/x";

	defineProps<{
		name: string;
		remarks: string;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();
</script>

<template>
	<!-- Backdrop -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close modal"
			class="absolute inset-0 bg-modal-scrim cursor-default w-full"
			@click="emit('close')"
			@keydown.esc="emit('close')"
		/>

		<!-- Modal -->
		<div
			class="relative bg-(--color-modal-bg) rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4"
		>
			<!-- Header -->
			<div class="flex items-start justify-between gap-3">
				<div class="flex flex-col gap-1">
					<span class="text-xs font-medium uppercase tracking-wider text-label"
						>Remarks</span
					>
					<h2 class="font-[540] text-base tracking-[-0.02em]">{{ name }}</h2>
				</div>
				<button
					type="button"
					@click="emit('close')"
					class="p-1.5 rounded-full hover:bg-surface transition-colors text-muted cursor-pointer"
					aria-label="Close"
				>
					<IconX class="w-4 h-4" aria-hidden="true" />
				</button>
			</div>

			<p class="text-sm whitespace-pre-wrap break-words">{{ remarks }}</p>

			<div class="flex justify-end pt-1">
				<button
					type="button"
					@click="emit('close')"
					class="px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] border border-hairline hover:bg-surface transition-colors cursor-pointer"
				>
					Close
				</button>
			</div>
		</div>
	</div>
</template>

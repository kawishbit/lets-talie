<script setup lang="ts">
	import { useRegisterSW } from "virtual:pwa-register/vue";

	const { needRefresh, updateServiceWorker } = useRegisterSW({
		immediate: true,
	});

	function dismiss() {
		needRefresh.value = false;
	}

	function applyUpdate() {
		void updateServiceWorker(true);
	}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="needRefresh"
			class="fixed inset-x-0 bottom-0 z-[100] p-4 pointer-events-none flex justify-center sm:justify-end"
			role="alertdialog"
			aria-labelledby="update-prompt-title"
			aria-describedby="update-prompt-desc"
		>
			<div
				class="pointer-events-auto w-full max-w-sm rounded-2xl border border-hairline bg-(--color-canvas) p-4 shadow-lg"
			>
				<p
					id="update-prompt-title"
					class="text-[15px] font-[540] tracking-[-0.01em] text-ink"
				>
					Update available
				</p>
				<p id="update-prompt-desc" class="mt-1 text-sm text-muted leading-snug">
					A new version of lets-talie is ready. Update to load the latest app.
				</p>
				<div class="mt-4 flex items-center justify-end gap-2">
					<button
						type="button"
						class="px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] border border-hairline hover:bg-surface transition-colors cursor-pointer"
						@click="dismiss"
					>
						Later
					</button>
					<button
						type="button"
						class="px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] bg-ink text-(--color-canvas) hover:opacity-80 transition-opacity cursor-pointer"
						@click="applyUpdate"
					>
						Update
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>

import UpdatePrompt from "@components/UpdatePrompt.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const needRefresh = ref(false);
const updateServiceWorker = vi.fn().mockResolvedValue(undefined);

vi.mock("virtual:pwa-register/vue", () => ({
	useRegisterSW: () => ({
		needRefresh,
		offlineReady: ref(false),
		updateServiceWorker,
	}),
}));

function dialogEl() {
	return document.body.querySelector<HTMLElement>("[role='alertdialog']");
}

describe("UpdatePrompt", () => {
	beforeEach(() => {
		needRefresh.value = false;
		updateServiceWorker.mockClear();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("is hidden when no update is waiting", () => {
		const wrapper = mount(UpdatePrompt, { attachTo: document.body });
		expect(dialogEl()).toBeNull();
		wrapper.unmount();
	});

	it("shows the update dialog when needRefresh is true", async () => {
		needRefresh.value = true;
		const wrapper = mount(UpdatePrompt, { attachTo: document.body });
		await flushPromises();

		const dialog = dialogEl();
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain("Update available");
		expect(dialog?.textContent).toContain("Update");
		expect(dialog?.textContent).toContain("Later");
		wrapper.unmount();
	});

	it("dismisses the dialog when Later is clicked", async () => {
		needRefresh.value = true;
		const wrapper = mount(UpdatePrompt, { attachTo: document.body });
		await flushPromises();

		const later = Array.from(dialogEl()?.querySelectorAll("button") ?? []).find(
			(b) => b.textContent?.trim() === "Later",
		);
		expect(later).toBeDefined();
		later?.click();
		await flushPromises();

		expect(needRefresh.value).toBe(false);
		wrapper.unmount();
	});

	it("calls updateServiceWorker when Update is clicked", async () => {
		needRefresh.value = true;
		const wrapper = mount(UpdatePrompt, { attachTo: document.body });
		await flushPromises();

		const update = Array.from(
			dialogEl()?.querySelectorAll("button") ?? [],
		).find((b) => b.textContent?.trim() === "Update");
		expect(update).toBeDefined();
		update?.click();
		await flushPromises();

		expect(updateServiceWorker).toHaveBeenCalledWith(true);
		wrapper.unmount();
	});
});

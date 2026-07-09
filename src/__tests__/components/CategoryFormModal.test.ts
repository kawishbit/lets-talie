import CategoryFormModal from "@components/CategoryFormModal.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const existingCategory = {
	id: "c1",
	label: "Food",
	remarks: "Groceries & dining",
	createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "c1" }) }),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("CategoryFormModal", () => {
	it("renders a create form with empty fields when editingCategory is null", () => {
		const wrapper = mount(CategoryFormModal, {
			props: { editingCategory: null },
		});
		expect(wrapper.text()).toContain("Create category");
		expect(
			(wrapper.find("#modal-label").element as HTMLInputElement).value,
		).toBe("");
	});

	it("renders an edit form pre-populated when editingCategory is provided", () => {
		const wrapper = mount(CategoryFormModal, {
			props: { editingCategory: existingCategory },
		});
		expect(wrapper.text()).toContain("Edit category");
		expect(
			(wrapper.find("#modal-label").element as HTMLInputElement).value,
		).toBe("Food");
	});

	it("emits saved via POST on successful create", async () => {
		const wrapper = mount(CategoryFormModal, {
			props: { editingCategory: null },
		});
		await wrapper.find("#modal-label").setValue("Transport");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/categories",
			expect.objectContaining({ method: "POST" }),
		);
		expect(wrapper.emitted("saved")).toBeTruthy();
	});

	it("emits saved via PATCH on successful edit", async () => {
		const wrapper = mount(CategoryFormModal, {
			props: { editingCategory: existingCategory },
		});
		await wrapper.find("#modal-label").setValue("Food & Drinks");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/categories/c1",
			expect.objectContaining({ method: "PATCH" }),
		);
		expect(wrapper.emitted("saved")).toBeTruthy();
	});

	it("disables submit until label is non-empty", () => {
		const wrapper = mount(CategoryFormModal, {
			props: { editingCategory: null },
		});
		expect(
			wrapper.find('button[type="submit"]').attributes("disabled"),
		).toBeDefined();
	});
});

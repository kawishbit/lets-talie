import CategoryTable from "@components/CategoryTable.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const categories = [
	{
		id: "c1",
		label: "Food",
		remarks: "Groceries",
		createdAt: "2026-01-01T00:00:00.000Z",
	},
];

function mountTable() {
	return mount(CategoryTable, {
		props: {
			initialCategories: categories,
			initialTotal: categories.length,
			initialPage: 1,
			pageSize: 20,
		},
	});
}

beforeEach(() => {
	vi.stubGlobal(
		"confirm",
		vi.fn(() => true),
	);
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("CategoryTable", () => {
	it("renders category rows", () => {
		const wrapper = mountTable();
		expect(wrapper.text()).toContain("Food");
		expect(wrapper.text()).toContain("Groceries");
	});

	it("opens the edit modal pre-filled when the edit button is clicked", async () => {
		const wrapper = mountTable();
		await wrapper.find('[title="Edit"]').trigger("click");
		expect(wrapper.text()).toContain("Edit category");
		expect(
			(wrapper.find("#modal-label").element as HTMLInputElement).value,
		).toBe("Food");
	});

	it("calls the delete API after confirmation", async () => {
		const wrapper = mountTable();
		await wrapper.find('[title="Delete"]').trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith("/api/categories/c1", {
			method: "DELETE",
		});
	});

	it("does not call the delete API when confirmation is dismissed", async () => {
		vi.stubGlobal(
			"confirm",
			vi.fn(() => false),
		);
		const wrapper = mountTable();
		await wrapper.find('[title="Delete"]').trigger("click");
		await flushPromises();

		expect(fetch).not.toHaveBeenCalled();
	});
});

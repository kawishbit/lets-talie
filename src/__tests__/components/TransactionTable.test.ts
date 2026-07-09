import TransactionTable from "@components/TransactionTable.vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows = [
	{
		id: "t1",
		transactionGroupId: null,
		name: "Rent",
		date: "2026-01-01T00:00:00.000Z",
		remarks: null,
		amount: "1200.00",
		type: "withdrawal" as const,
		status: "completed" as const,
		paidByUserId: "user-a",
		paidByUserName: "Alice",
		categoryId: null,
		categoryLabel: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		deletedAt: null,
	},
	{
		id: "t2",
		transactionGroupId: null,
		name: "Old refund",
		date: "2026-01-02T00:00:00.000Z",
		remarks: null,
		amount: "50.00",
		type: "deposit" as const,
		status: "cancelled" as const,
		paidByUserId: "user-a",
		paidByUserName: "Alice",
		categoryId: null,
		categoryLabel: null,
		createdAt: "2026-01-02T00:00:00.000Z",
		deletedAt: "2026-01-03T00:00:00.000Z",
	},
];

function mountTable() {
	return mount(TransactionTable, {
		props: {
			initialItems: rows,
			initialTotal: rows.length,
			initialPage: 1,
			pageSize: 20,
			isAdmin: true,
			categories: [],
		},
	});
}

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("TransactionTable", () => {
	it("renders a row for each transaction", () => {
		const wrapper = mountTable();
		expect(wrapper.text()).toContain("Rent");
		expect(wrapper.text()).toContain("Old refund");
	});

	it("applies a greyed-out style to soft-deleted rows", () => {
		const wrapper = mountTable();
		const trs = wrapper.findAll("tbody tr");
		const deletedRow = trs.find((tr) => tr.text().includes("Old refund"));
		expect(deletedRow?.classes()).toContain("opacity-40");
	});

	it("does not grey out non-deleted rows", () => {
		const wrapper = mountTable();
		const trs = wrapper.findAll("tbody tr");
		const activeRow = trs.find((tr) => tr.text().includes("Rent"));
		expect(activeRow?.classes()).not.toContain("opacity-40");
	});

	it("shows the status badge text for each row", () => {
		const wrapper = mountTable();
		expect(wrapper.text()).toContain("completed");
		expect(wrapper.text()).toContain("cancelled");
	});
});

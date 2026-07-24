import TransactionTable from "@components/TransactionTable.vue";
import { flushPromises, mount } from "@vue/test-utils";
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
	{
		id: "t3",
		transactionGroupId: "group-1",
		name: "Uber split",
		date: "2026-01-04T00:00:00.000Z",
		remarks: null,
		amount: "10.00",
		type: "withdrawal" as const,
		status: "completed" as const,
		paidByUserId: "user-b",
		paidByUserName: "Bob",
		categoryId: null,
		categoryLabel: null,
		createdAt: "2026-01-04T00:00:00.000Z",
		deletedAt: null,
	},
	{
		id: "t4",
		transactionGroupId: null,
		name: "Pending tip",
		date: "2026-01-05T00:00:00.000Z",
		remarks: null,
		amount: "5.00",
		type: "withdrawal" as const,
		status: "pending" as const,
		paidByUserId: "user-a",
		paidByUserName: "Alice",
		categoryId: null,
		categoryLabel: null,
		createdAt: "2026-01-05T00:00:00.000Z",
		deletedAt: null,
	},
];

const users = [
	{ id: "user-a", name: "Alice", email: "alice@example.com" },
	{ id: "user-b", name: "Bob", email: "bob@example.com" },
];

function mountTable(isAdmin = true) {
	return mount(TransactionTable, {
		props: {
			initialItems: rows,
			initialTotal: rows.length,
			initialPage: 1,
			pageSize: 20,
			isAdmin,
			categories: [],
			users,
		},
		global: {
			stubs: {
				Teleport: true,
				TransactionFormModal: true,
			},
		},
	});
}

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
	vi.stubGlobal(
		"confirm",
		vi.fn(() => true),
	);
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

	it("shows Paid by column for admins", () => {
		const wrapper = mountTable(true);
		expect(wrapper.text()).toContain("Paid by");
		expect(wrapper.text()).toContain("Alice");
		expect(wrapper.text()).toContain("Bob");
	});

	it("hides Paid by column and actions for non-admins", () => {
		const wrapper = mountTable(false);
		expect(wrapper.text()).not.toContain("Paid by");
		expect(wrapper.text()).not.toContain("Actions");
		expect(wrapper.find('[title="Edit"]').exists()).toBe(false);
		expect(wrapper.find('[title="Mark as cancelled"]').exists()).toBe(false);
	});

	it("shows edit and cancel on eligible single rows", () => {
		const wrapper = mountTable(true);
		const rentRow = wrapper
			.findAll("tbody tr")
			.find((tr) => tr.text().includes("Rent"));
		expect(rentRow?.find('[title="Edit"]').exists()).toBe(true);
		expect(rentRow?.find('[title="Mark as cancelled"]').exists()).toBe(true);
	});

	it("allows edit and cancel on rows that share a transactionGroupId", () => {
		const wrapper = mountTable(true);
		const groupRow = wrapper
			.findAll("tbody tr")
			.find((tr) => tr.text().includes("Uber split"));
		expect(groupRow?.find('[title="Edit"]').exists()).toBe(true);
		expect(groupRow?.find('[title="Mark as cancelled"]').exists()).toBe(true);
	});

	it("hides cancel on cancelled rows and edit on deleted rows", () => {
		const wrapper = mountTable(true);
		const deletedRow = wrapper
			.findAll("tbody tr")
			.find((tr) => tr.text().includes("Old refund"));
		expect(deletedRow?.find('[title="Edit"]').exists()).toBe(false);
		expect(deletedRow?.find('[title="Mark as cancelled"]').exists()).toBe(
			false,
		);
	});

	it("cancels a single transaction via PATCH after confirm", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					items: rows,
					total: rows.length,
					page: 1,
				}),
			}),
		);

		const wrapper = mountTable(true);
		const rentRow = wrapper
			.findAll("tbody tr")
			.find((tr) => tr.text().includes("Rent"));
		await rentRow?.find('[title="Mark as cancelled"]').trigger("click");
		await flushPromises();

		expect(confirm).toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/t1",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ status: "cancelled" }),
			}),
		);
	});
});

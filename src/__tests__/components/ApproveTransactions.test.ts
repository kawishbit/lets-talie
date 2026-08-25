import ApproveTransactions from "@components/ApproveTransactions.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors the PendingEntry interface in ApproveTransactions.vue. The fixtures
// need it explicitly: without it TS widens `kind`/`type` to string and infers
// the nullable fields from groupEntry alone, so singleEntry stops matching.
interface PendingEntry {
	id: string;
	kind: "group" | "single";
	name: string;
	date: string;
	totalAmount: string;
	type: "deposit" | "withdrawal";
	paidByUserName: string | null;
	paidByUserId: string;
	parties: { userId: string; userName: string | null; amount: string }[];
	categoryLabel: string | null;
	createdAt: string;
}

const groupEntry: PendingEntry = {
	id: "g1",
	kind: "group",
	name: "Dinner",
	date: "2026-01-10",
	totalAmount: "30.00",
	type: "deposit",
	paidByUserName: "Alice",
	paidByUserId: "user-a",
	parties: [
		{ userId: "user-a", userName: "Alice", amount: "15.00" },
		{ userId: "user-b", userName: "Bob", amount: "15.00" },
	],
	categoryLabel: "Food",
	createdAt: "2026-01-10T12:00:00.000Z",
};

const singleEntry: PendingEntry = {
	id: "s1",
	kind: "single",
	name: "Cash top-up",
	date: "2026-01-11",
	totalAmount: "20.00",
	type: "withdrawal",
	paidByUserName: "Carol",
	paidByUserId: "user-c",
	parties: [],
	categoryLabel: null,
	createdAt: "2026-01-11T12:00:00.000Z",
};

function mountList(initialGroups: PendingEntry[] = [groupEntry]) {
	return mount(ApproveTransactions, {
		props: {
			initialGroups,
			initialTotal: initialGroups.length,
			initialPage: 1,
			pageSize: 10,
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
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({}),
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ApproveTransactions", () => {
	it("renders pending groups", () => {
		const wrapper = mountList();
		expect(wrapper.text()).toContain("Dinner");
		expect(wrapper.text()).toContain("Alice");
	});

	it("renders pending single transactions without a parties list", () => {
		const wrapper = mountList([singleEntry]);
		expect(wrapper.text()).toContain("Cash top-up");
		expect(wrapper.text()).toContain("Carol");
		expect(wrapper.text()).not.toContain("Parties");
	});

	it("shows an empty state when there are no pending groups", () => {
		const wrapper = mount(ApproveTransactions, {
			props: {
				initialGroups: [],
				initialTotal: 0,
				initialPage: 1,
				pageSize: 10,
			},
		});
		expect(wrapper.text()).toContain("No pending transactions to review.");
	});

	it("calls the group status API and removes the group from the list on approve", async () => {
		const wrapper = mountList();
		const approveBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Approve");
		await approveBtn?.trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/group/g1/status",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ action: "approve" }),
			}),
		);
		expect(wrapper.text()).not.toContain("Dinner");
		expect(wrapper.text()).toContain("No pending transactions to review.");
	});

	it("calls the group status API and removes the group from the list on reject", async () => {
		const wrapper = mountList();
		const rejectBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Reject");
		await rejectBtn?.trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/group/g1/status",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ action: "reject" }),
			}),
		);
		expect(wrapper.text()).not.toContain("Dinner");
	});

	it("calls the transaction PATCH endpoint and removes the entry from the list on single approve", async () => {
		const wrapper = mountList([singleEntry]);
		const approveBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Approve");
		await approveBtn?.trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/s1",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ status: "completed" }),
			}),
		);
		expect(wrapper.text()).not.toContain("Cash top-up");
	});

	it("calls the transaction PATCH endpoint with cancelled status on single reject", async () => {
		const wrapper = mountList([singleEntry]);
		const rejectBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Reject");
		await rejectBtn?.trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/s1",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ status: "cancelled" }),
			}),
		);
	});

	it("does not call the API when the confirm dialog is dismissed", async () => {
		vi.stubGlobal(
			"confirm",
			vi.fn(() => false),
		);
		const wrapper = mountList();
		const approveBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Approve");
		await approveBtn?.trigger("click");
		await flushPromises();

		expect(fetch).not.toHaveBeenCalled();
		expect(wrapper.text()).toContain("Dinner");
	});

	it("shows an error message when the API call fails and keeps the group listed", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: "Group already processed" }),
			}),
		);
		const wrapper = mountList();
		const approveBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Approve");
		await approveBtn?.trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain("Group already processed");
		expect(wrapper.text()).toContain("Dinner");
	});
});

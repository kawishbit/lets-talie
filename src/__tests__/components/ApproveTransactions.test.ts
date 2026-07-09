import ApproveTransactions from "@components/ApproveTransactions.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const groups = [
	{
		groupId: "g1",
		name: "Dinner",
		date: "2026-01-10",
		totalAmount: "30.00",
		paidByUserName: "Alice",
		paidByUserId: "user-a",
		parties: [
			{ userId: "user-a", userName: "Alice", amount: "15.00" },
			{ userId: "user-b", userName: "Bob", amount: "15.00" },
		],
		categoryLabel: "Food",
		createdAt: "2026-01-10T12:00:00.000Z",
	},
];

function mountList() {
	return mount(ApproveTransactions, {
		props: {
			initialGroups: groups,
			initialTotal: 1,
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

	it("calls the approve API and removes the group from the list on success", async () => {
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

	it("calls the reject API and removes the group from the list on success", async () => {
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

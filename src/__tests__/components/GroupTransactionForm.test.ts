import GroupTransactionForm from "@components/GroupTransactionForm.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const users = [
	{ id: "user-a", name: "Alice", email: "alice@example.com" },
	{ id: "user-b", name: "Bob", email: "bob@example.com" },
	{ id: "user-c", name: "Carol", email: "carol@example.com" },
];
const categories = [{ id: "cat-1", label: "Food" }];

function mountForm() {
	return mount(GroupTransactionForm, {
		props: { users, categories, currentUserId: "user-a" },
	});
}

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ groupId: "g1" }),
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("GroupTransactionForm", () => {
	it("renders name, date, amount, paid-by, and party fields", () => {
		const wrapper = mountForm();
		expect(wrapper.find("#gt-name").exists()).toBe(true);
		expect(wrapper.find("#gt-date").exists()).toBe(true);
		expect(wrapper.find("#gt-amount").exists()).toBe(true);
		expect(wrapper.find("#gt-paidby").exists()).toBe(true);
		expect(wrapper.findAll("button[type=button]").length).toBeGreaterThan(0);
	});

	it("keeps the payer selected as a party and disables toggling them off", async () => {
		const wrapper = mountForm();
		const payerChip = wrapper
			.findAll("button[type=button]")
			.find((b) => b.text() === "Alice");
		expect(payerChip?.attributes("disabled")).toBeDefined();
	});

	it("does not show the custom-amount toggle until more than one party is selected", () => {
		const wrapper = mountForm();
		expect(wrapper.find("#customAmounts").exists()).toBe(false);
	});

	it("enables custom amount inputs once toggled with multiple parties", async () => {
		const wrapper = mountForm();
		const bobChip = wrapper
			.findAll("button[type=button]")
			.find((b) => b.text() === "Bob");
		await bobChip?.trigger("click");

		expect(wrapper.find("#customAmounts").exists()).toBe(true);
		await wrapper.find("#customAmounts").setValue(true);

		// Two number inputs for the two selected parties (Alice + Bob)
		const customInputs = wrapper.findAll('input[type="number"]');
		// gt-amount + 2 custom-amount inputs
		expect(customInputs.length).toBe(3);
	});

	it("disables submit when custom amounts don't sum to the total", async () => {
		const wrapper = mountForm();
		await wrapper.find("#gt-name").setValue("Dinner");
		await wrapper.find("#gt-amount").setValue("30");

		const bobChip = wrapper
			.findAll("button[type=button]")
			.find((b) => b.text() === "Bob");
		await bobChip?.trigger("click");
		await wrapper.find("#customAmounts").setValue(true);

		const customInputs = wrapper.findAll('input[type="number"]');
		// customInputs[0] is the amount field; [1] and [2] are per-party amounts
		await customInputs[1].setValue("10");
		await customInputs[2].setValue("10"); // sums to 20, not 30

		expect(
			wrapper.find('button[type="submit"]').attributes("disabled"),
		).toBeDefined();
		expect(wrapper.text()).toContain("Sum: 20.00 / 30");
	});

	it("enables submit once custom amounts sum to the total", async () => {
		const wrapper = mountForm();
		await wrapper.find("#gt-name").setValue("Dinner");
		await wrapper.find("#gt-amount").setValue("30");

		const bobChip = wrapper
			.findAll("button[type=button]")
			.find((b) => b.text() === "Bob");
		await bobChip?.trigger("click");
		await wrapper.find("#customAmounts").setValue(true);

		const customInputs = wrapper.findAll('input[type="number"]');
		await customInputs[1].setValue("20");
		await customInputs[2].setValue("10");

		expect(
			wrapper.find('button[type="submit"]').attributes("disabled"),
		).toBeUndefined();
	});

	it("submits the correct equal-split payload to the API", async () => {
		const wrapper = mountForm();
		await wrapper.find("#gt-name").setValue("Dinner");
		await wrapper.find("#gt-amount").setValue("30");

		const bobChip = wrapper
			.findAll("button[type=button]")
			.find((b) => b.text() === "Bob");
		await bobChip?.trigger("click");

		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/group",
			expect.objectContaining({
				method: "POST",
				body: expect.stringContaining('"parties":["user-a","user-b"]'),
			}),
		);
		const call = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(call[1]?.body as string);
		expect(body).toMatchObject({
			name: "Dinner",
			amount: 30,
			paidByUserId: "user-a",
			parties: ["user-a", "user-b"],
		});
		expect(body.customAmounts).toBeUndefined();
	});

	it("submits customAmounts in the payload when custom split is enabled", async () => {
		const wrapper = mountForm();
		await wrapper.find("#gt-name").setValue("Dinner");
		await wrapper.find("#gt-amount").setValue("30");

		const bobChip = wrapper
			.findAll("button[type=button]")
			.find((b) => b.text() === "Bob");
		await bobChip?.trigger("click");
		await wrapper.find("#customAmounts").setValue(true);

		const customInputs = wrapper.findAll('input[type="number"]');
		await customInputs[1].setValue("20");
		await customInputs[2].setValue("10");

		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		const call = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(call[1]?.body as string);
		expect(body.customAmounts).toEqual({ "user-a": 20, "user-b": 10 });
	});

	it("shows an error message when the API request fails", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			json: async () => ({ error: "Something broke" }),
		} as never);

		const wrapper = mountForm();
		await wrapper.find("#gt-name").setValue("Dinner");
		await wrapper.find("#gt-amount").setValue("30");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(wrapper.text()).toContain("Something broke");
	});
});

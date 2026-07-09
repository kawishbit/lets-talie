import SingleTransactionForm from "@components/SingleTransactionForm.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const users = [{ id: "user-a", name: "Alice", email: "alice@example.com" }];
const categories = [{ id: "cat-1", label: "Food" }];

function mountForm() {
	return mount(SingleTransactionForm, { props: { users, categories } });
}

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "t1" }) }),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SingleTransactionForm", () => {
	it("renders name, date, amount, user, type, and status fields", () => {
		const wrapper = mountForm();
		expect(wrapper.find("#tx-name").exists()).toBe(true);
		expect(wrapper.find("#tx-date").exists()).toBe(true);
		expect(wrapper.find("#tx-amount").exists()).toBe(true);
		expect(wrapper.find("#tx-user").exists()).toBe(true);
		expect(wrapper.find("#tx-type").exists()).toBe(true);
		expect(wrapper.find("#tx-status").exists()).toBe(true);
	});

	it("disables submit until required fields are filled", async () => {
		const wrapper = mountForm();
		expect(
			wrapper.find('button[type="submit"]').attributes("disabled"),
		).toBeDefined();

		await wrapper.find("#tx-name").setValue("Adjustment");
		await wrapper.find("#tx-amount").setValue("20");
		await wrapper.find("#tx-user").setValue("user-a");

		expect(
			wrapper.find('button[type="submit"]').attributes("disabled"),
		).toBeUndefined();
	});

	it("submits the correct payload to the API", async () => {
		const wrapper = mountForm();
		await wrapper.find("#tx-name").setValue("Adjustment");
		await wrapper.find("#tx-amount").setValue("20");
		await wrapper.find("#tx-user").setValue("user-a");
		await wrapper.find("#tx-type").setValue("deposit");

		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/single",
			expect.objectContaining({ method: "POST" }),
		);
		const call = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(call[1]?.body as string);
		expect(body).toMatchObject({
			name: "Adjustment",
			amount: 20,
			paidByUserId: "user-a",
			type: "deposit",
			status: "completed",
		});
	});

	it("shows an error message when the API request fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: "Invalid payload" }),
			}),
		);
		const wrapper = mountForm();
		await wrapper.find("#tx-name").setValue("Adjustment");
		await wrapper.find("#tx-amount").setValue("20");
		await wrapper.find("#tx-user").setValue("user-a");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(wrapper.text()).toContain("Invalid payload");
	});
});

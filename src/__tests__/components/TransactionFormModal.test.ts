import TransactionFormModal from "@components/TransactionFormModal.vue";
import { toDateInputValue } from "@utils/date";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
	id: "tx-1",
	transactionGroupId: null,
	name: "Rent",
	date: "2026-01-15T14:30:00.000Z",
	remarks: "monthly",
	amount: "1200.00",
	type: "withdrawal" as const,
	status: "completed" as const,
	paidByUserId: "user-a",
	paidByUserName: "Alice",
	categoryId: "cat-1",
	categoryLabel: "Housing",
	createdAt: "2026-01-01T00:00:00.000Z",
	deletedAt: null,
};

const users = [
	{ id: "user-a", name: "Alice", email: "alice@example.com" },
	{ id: "user-b", name: "Bob", email: "bob@example.com" },
];

const categories = [{ id: "cat-1", label: "Housing" }];

function mountModal() {
	return mount(TransactionFormModal, {
		props: { transaction, users, categories },
	});
}

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "tx-1" }) }),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("TransactionFormModal", () => {
	it("renders an edit form pre-populated from the transaction", () => {
		const wrapper = mountModal();
		expect(wrapper.text()).toContain("Edit transaction");
		expect(
			(wrapper.find("#edit-tx-name").element as HTMLInputElement).value,
		).toBe("Rent");
		expect(
			(wrapper.find("#edit-tx-date").element as HTMLInputElement).value,
		).toBe(toDateInputValue(transaction.date));
		expect(
			(wrapper.find("#edit-tx-amount").element as HTMLInputElement).value,
		).toBe("1200");
		expect(
			(wrapper.find("#edit-tx-user").element as HTMLSelectElement).value,
		).toBe("user-a");
		expect(
			(wrapper.find("#edit-tx-type").element as HTMLSelectElement).value,
		).toBe("withdrawal");
		expect(
			(wrapper.find("#edit-tx-status").element as HTMLSelectElement).value,
		).toBe("completed");
	});

	it("emits saved via PATCH on a successful edit", async () => {
		const wrapper = mountModal();
		await wrapper.find("#edit-tx-name").setValue("Updated rent");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/tx-1",
			expect.objectContaining({ method: "PATCH" }),
		);
		const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		const body = JSON.parse(opts.body as string);
		expect(body.name).toBe("Updated rent");
		expect(body.amount).toBe(1200);
		expect(body.paidByUserId).toBe("user-a");
		// Full ISO — preserves original time-of-day, not date-only
		expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(new Date(body.date).getMinutes()).toBe(
			new Date(transaction.date).getMinutes(),
		);
		expect(wrapper.emitted("saved")).toBeTruthy();
	});

	it("shows an error message on a failed request and does not emit saved", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: "Cannot edit group row" }),
			}),
		);
		const wrapper = mountModal();
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(wrapper.text()).toContain("Cannot edit group row");
		expect(wrapper.emitted("saved")).toBeFalsy();
	});

	it("emits close when the cancel button is clicked", async () => {
		const wrapper = mountModal();
		const cancelBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Cancel");
		await cancelBtn?.trigger("click");
		expect(wrapper.emitted("close")).toBeTruthy();
	});
});

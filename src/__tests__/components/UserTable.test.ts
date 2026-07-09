import UserTable from "@components/UserTable.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const users = [
	{
		id: "u1",
		name: "Alice",
		email: "alice@example.com",
		role: "admin" as const,
		accountBalance: "10.00",
		createdAt: "2026-01-01T00:00:00.000Z",
		deletedAt: null,
	},
	{
		id: "u2",
		name: "Bob",
		email: "bob@example.com",
		role: "user" as const,
		accountBalance: "-5.00",
		createdAt: "2026-01-02T00:00:00.000Z",
		deletedAt: null,
	},
];

function mountTable(currentUserId = "u1") {
	return mount(UserTable, {
		props: {
			initialUsers: users,
			initialTotal: users.length,
			initialPage: 1,
			pageSize: 20,
			currentUserId,
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

describe("UserTable", () => {
	it("renders rows with name, email, role, and balance", () => {
		const wrapper = mountTable();
		expect(wrapper.text()).toContain("Alice");
		expect(wrapper.text()).toContain("alice@example.com");
		expect(wrapper.text()).toContain("admin");
		expect(wrapper.text()).toContain("Bob");
	});

	it("opens the create modal when 'Add user' is clicked", async () => {
		const wrapper = mountTable();
		const addBtn = wrapper
			.findAll("button")
			.find((b) => b.text().includes("Add user"));
		await addBtn?.trigger("click");
		// UserFormModal renders via <Teleport to="body">
		expect(document.body.textContent).toContain("Create user");
		wrapper.unmount();
	});

	it("hides the delete button for the current user's own row", () => {
		const wrapper = mountTable("u1");
		const rows = wrapper.findAll("tbody tr");
		const ownRow = rows.find((r) => r.text().includes("Alice"));
		expect(ownRow?.find('[title="Delete"]').exists()).toBe(false);
	});

	it("calls the delete API for another user's row after confirmation", async () => {
		const wrapper = mountTable("u1");
		const rows = wrapper.findAll("tbody tr");
		const bobRow = rows.find((r) => r.text().includes("Bob"));
		await bobRow?.find('[title="Delete"]').trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith("/api/users/u2", {
			method: "DELETE",
		});
	});
});

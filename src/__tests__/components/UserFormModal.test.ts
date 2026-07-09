import UserFormModal from "@components/UserFormModal.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const existingUser = {
	id: "u1",
	name: "Alice",
	email: "alice@example.com",
	role: "user" as const,
	accountBalance: "0.00",
	createdAt: "2026-01-01T00:00:00.000Z",
	deletedAt: null,
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "u1" }) }),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("UserFormModal", () => {
	it("renders a create form with empty fields when editingUser is null", () => {
		const wrapper = mount(UserFormModal, { props: { editingUser: null } });
		expect(wrapper.text()).toContain("Create user");
		expect(
			(wrapper.find("#modal-name").element as HTMLInputElement).value,
		).toBe("");
	});

	it("renders an edit form pre-populated when editingUser is provided", () => {
		const wrapper = mount(UserFormModal, {
			props: { editingUser: existingUser },
		});
		expect(wrapper.text()).toContain("Edit user");
		expect(
			(wrapper.find("#modal-name").element as HTMLInputElement).value,
		).toBe("Alice");
		expect(
			(wrapper.find("#modal-email").element as HTMLInputElement).value,
		).toBe("alice@example.com");
	});

	it("emits saved on a successful create", async () => {
		const wrapper = mount(UserFormModal, { props: { editingUser: null } });
		await wrapper.find("#modal-name").setValue("Bob");
		await wrapper.find("#modal-email").setValue("bob@example.com");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/users",
			expect.objectContaining({ method: "POST" }),
		);
		expect(wrapper.emitted("saved")).toBeTruthy();
	});

	it("emits saved via PATCH on a successful edit", async () => {
		const wrapper = mount(UserFormModal, {
			props: { editingUser: existingUser },
		});
		await wrapper.find("#modal-name").setValue("Alice Updated");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/users/u1",
			expect.objectContaining({ method: "PATCH" }),
		);
		expect(wrapper.emitted("saved")).toBeTruthy();
	});

	it("shows an error message on a failed request and does not emit saved", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: "Email already exists" }),
			}),
		);
		const wrapper = mount(UserFormModal, { props: { editingUser: null } });
		await wrapper.find("#modal-name").setValue("Bob");
		await wrapper.find("#modal-email").setValue("bob@example.com");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(wrapper.text()).toContain("Email already exists");
		expect(wrapper.emitted("saved")).toBeFalsy();
	});

	it("emits close when the cancel button is clicked", async () => {
		const wrapper = mount(UserFormModal, { props: { editingUser: null } });
		const cancelBtn = wrapper
			.findAll("button")
			.find((b) => b.text() === "Cancel");
		await cancelBtn?.trigger("click");
		expect(wrapper.emitted("close")).toBeTruthy();
	});
});

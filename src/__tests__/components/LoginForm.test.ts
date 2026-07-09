import LoginForm from "@components/LoginForm.vue";
import { authClient } from "@lib/auth-client";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/auth-client", () => ({
	authClient: {
		passwordlessBundle: {
			request: vi.fn(),
			verifyOtp: vi.fn(),
		},
	},
}));

const mockRequest = vi.mocked(authClient.passwordlessBundle.request);
const mockVerifyOtp = vi.mocked(authClient.passwordlessBundle.verifyOtp);

beforeEach(() => {
	vi.stubEnv("PUBLIC_DEMO_MODE", "false");
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("LoginForm", () => {
	it("renders the email input and submit button", () => {
		const wrapper = mount(LoginForm);
		expect(wrapper.find("#email").exists()).toBe(true);
		expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
	});

	it("disables the submit button while the email request is in flight", async () => {
		let resolveRequest: (v: unknown) => void = () => {};
		mockRequest.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve;
			}) as never,
		);

		const wrapper = mount(LoginForm);
		await wrapper.find("#email").setValue("user@example.com");
		await wrapper.find("form").trigger("submit.prevent");

		expect(
			wrapper.find('button[type="submit"]').attributes("disabled"),
		).toBeDefined();

		resolveRequest({ error: null });
		await flushPromises();
	});

	it("shows an error message when the email request fails", async () => {
		mockRequest.mockResolvedValue({
			error: { message: "Email not found" },
		} as never);

		const wrapper = mount(LoginForm);
		await wrapper.find("#email").setValue("user@example.com");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(wrapper.text()).toContain("Email not found");
		// Stays on the email step
		expect(wrapper.find("#email").exists()).toBe(true);
	});

	it("advances to the OTP step on a successful email request", async () => {
		mockRequest.mockResolvedValue({ error: null } as never);

		const wrapper = mount(LoginForm);
		await wrapper.find("#email").setValue("user@example.com");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(wrapper.find("#otp").exists()).toBe(true);
		expect(wrapper.find("#email").exists()).toBe(false);
	});

	it("shows an error message when OTP verification fails", async () => {
		mockRequest.mockResolvedValue({ error: null } as never);
		mockVerifyOtp.mockResolvedValue({
			error: { message: "Invalid code" },
		} as never);

		const wrapper = mount(LoginForm);
		await wrapper.find("#email").setValue("user@example.com");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		await wrapper.find("#otp").setValue("123456");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		expect(wrapper.text()).toContain("Invalid code");
	});

	it('"Use a different email" resets back to the email step', async () => {
		mockRequest.mockResolvedValue({ error: null } as never);

		const wrapper = mount(LoginForm);
		await wrapper.find("#email").setValue("user@example.com");
		await wrapper.find("form").trigger("submit.prevent");
		await flushPromises();

		await wrapper.find('button[type="button"]').trigger("click");

		expect(wrapper.find("#email").exists()).toBe(true);
	});

	it("renders the demo-mode CTA instead of the form when PUBLIC_DEMO_MODE is true", async () => {
		vi.stubEnv("PUBLIC_DEMO_MODE", "true");
		const wrapper = mount(LoginForm);

		expect(wrapper.text()).toContain("Continue as Demo");
		expect(wrapper.find("#email").exists()).toBe(false);
	});
});

import { clearInbox, waitForLoginEmail } from "../helpers/mail";
import { expect, seedUser, test } from "./fixtures";

// 9m — E2E: real login flow through the browser UI — email -> OTP (read back
// from Mailpit, the same way a human would check their inbox) -> dashboard.
// Every other E2E spec injects a session cookie directly (see fixtures.ts)
// since re-running this UI dance per test would be slow; this file is the
// one place the actual login UI gets exercised end-to-end.

test("user signs in with email + OTP and lands on the dashboard", async ({
	page,
}) => {
	const { email } = await seedUser({ email: "e2e-login@test.dev" });
	await clearInbox();

	await page.goto("/login");
	await page.locator("#email").fill(email);
	await page.getByRole("button", { name: "Send login code" }).click();

	await expect(page.getByText("Check your inbox")).toBeVisible();

	const { otp } = await waitForLoginEmail(email);
	await page.locator("#otp").fill(otp);
	await page.getByRole("button", { name: "Sign in" }).click();

	await page.waitForURL("/dashboard");
	await expect(page.getByText("Your balance")).toBeVisible();
});

test("an incorrect OTP shows an error and does not sign the user in", async ({
	page,
}) => {
	const { email } = await seedUser({ email: "e2e-wrong-otp@test.dev" });
	await clearInbox();

	await page.goto("/login");
	await page.locator("#email").fill(email);
	await page.getByRole("button", { name: "Send login code" }).click();
	await expect(page.getByText("Check your inbox")).toBeVisible();

	await waitForLoginEmail(email);
	await page.locator("#otp").fill("000000");
	await page.getByRole("button", { name: "Sign in" }).click();

	// better-auth surfaces the raw error code (no friendly message mapped for
	// it), so the OTP form shows "INVALID_OTP" literally rather than a
	// human-readable sentence.
	await expect(page.getByText("INVALID_OTP")).toBeVisible();
	await expect(page).toHaveURL(/\/login$/);
});

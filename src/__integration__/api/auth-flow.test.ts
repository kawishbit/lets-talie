import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { seedUser } from "../helpers/db";
import { waitForLoginEmail } from "../helpers/mail";
import { apiFetch } from "../helpers/server";

// 9c — Auth Flow Integration, against the live better-auth endpoints. The
// plan text names generic `/api/auth/sign-in/magic-link` routes, but this
// app registers a custom `passwordless-bundle` plugin (src/lib/passwordless.ts)
// with its own paths — tests target the real routes instead of ones that
// don't exist here.

describe("POST /api/auth/passwordless-bundle/request", () => {
	it("returns 200 and sends a login email for an existing user", async () => {
		const { email } = await seedUser({ email: "existing@test.dev" });

		const res = await apiFetch("/api/auth/passwordless-bundle/request", {
			method: "POST",
			body: { email },
		});
		expect(res.status).toBe(200);

		const { otp, magicLinkUrl } = await waitForLoginEmail(email);
		expect(otp).toMatch(/^\d{6}$/);
		expect(magicLinkUrl).toContain("/passwordless-bundle/verify");
	});

	it("returns 200 without leaking whether the email is registered (anti-enumeration)", async () => {
		const res = await apiFetch("/api/auth/passwordless-bundle/request", {
			method: "POST",
			body: { email: "never-signed-up@test.dev" },
		});
		// The endpoint intentionally always reports success — sign-up itself
		// happens on verify (disableSignUp only blocks *new* accounts there).
		expect(res.status).toBe(200);
	});
});

describe("OTP verification (POST /api/auth/passwordless-bundle/verify-otp)", () => {
	it("creates a valid session and sets a session cookie on a correct OTP", async () => {
		const { email } = await seedUser({ email: "otp-user@test.dev" });

		await apiFetch("/api/auth/passwordless-bundle/request", {
			method: "POST",
			body: { email },
		});
		const { otp } = await waitForLoginEmail(email);

		const verifyRes = await apiFetch(
			"/api/auth/passwordless-bundle/verify-otp",
			{
				method: "POST",
				body: { email, otp },
			},
		);
		expect(verifyRes.status).toBe(200);
		const setCookie = verifyRes.headers.get("set-cookie");
		expect(setCookie).toMatch(/better-auth\.session_token=/);

		const cookie = setCookie?.split(";")[0] ?? "";
		const sessionRes = await apiFetch("/api/auth/get-session", { cookie });
		const sessionBody = (await sessionRes.json()) as {
			user?: { email: string };
		};
		expect(sessionBody.user?.email).toBe(email);
	});

	it("rejects an incorrect OTP", async () => {
		const { email } = await seedUser({ email: "wrong-otp@test.dev" });

		await apiFetch("/api/auth/passwordless-bundle/request", {
			method: "POST",
			body: { email },
		});
		await waitForLoginEmail(email);

		const verifyRes = await apiFetch(
			"/api/auth/passwordless-bundle/verify-otp",
			{
				method: "POST",
				body: { email, otp: "000000" },
			},
		);
		expect(verifyRes.status).toBe(400);
	});
});

describe("magic-link verification (GET /api/auth/passwordless-bundle/verify)", () => {
	it("creates a valid session and sets a session cookie on success", async () => {
		const { email } = await seedUser();
		await apiFetch("/api/auth/passwordless-bundle/request", {
			method: "POST",
			body: { email },
		});
		const { magicLinkUrl } = await waitForLoginEmail(email);
		const url = new URL(magicLinkUrl);

		const res = await apiFetch(`${url.pathname}${url.search}`);
		expect(res.status).toBe(302);
		expect(res.headers.get("set-cookie")).toMatch(
			/better-auth\.session_token=/,
		);
	});

	it("rejects an already-used token", async () => {
		const { email } = await seedUser();
		await apiFetch("/api/auth/passwordless-bundle/request", {
			method: "POST",
			body: { email },
		});
		const { magicLinkUrl } = await waitForLoginEmail(email);
		const url = new URL(magicLinkUrl);
		const path = `${url.pathname}${url.search}`;

		await apiFetch(path);
		const secondRes = await apiFetch(path);
		expect(secondRes.status).toBe(302);
		expect(secondRes.headers.get("location")).toContain("error=INVALID_TOKEN");
	});
});

describe("GET /api/auth/get-session", () => {
	it("returns session data when a valid cookie is present", async () => {
		const { id, email } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/auth/get-session", { cookie });
		const body = (await res.json()) as { user?: { email: string } };
		expect(body.user?.email).toBe(email);
	});

	it("returns null session when no cookie is present", async () => {
		const res = await apiFetch("/api/auth/get-session");
		const body = await res.json();
		expect(body).toBeNull();
	});
});

describe("POST /api/auth/sign-out", () => {
	it("invalidates the session so subsequent get-session calls return null", async () => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const signOutRes = await apiFetch("/api/auth/sign-out", {
			method: "POST",
			cookie,
		});
		expect(signOutRes.status).toBe(200);

		const afterRes = await apiFetch("/api/auth/get-session", { cookie });
		const afterBody = await afterRes.json();
		expect(afterBody).toBeNull();
	});
});

import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { seedAdmin, seedUser } from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9d — Middleware Integration, against the real Astro middleware + better-auth
// session lookup (src/middleware.ts). fetch uses redirect:"manual" so 302s are
// observed directly rather than followed.

describe("unauthenticated requests", () => {
	it.each([
		["/dashboard"],
		["/transactions"],
		["/users"],
	])("redirects %s to /login", async (path) => {
		const res = await apiFetch(path);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/login");
	});

	it.each([["/"], ["/login"]])("allows public route %s (200)", async (path) => {
		const res = await apiFetch(path);
		expect(res.status).toBe(200);
	});
});

describe("authenticated regular user", () => {
	it.each([
		["/users"],
		["/transaction-categories"],
		["/import-transactions"],
		["/approve-transactions"],
	])("redirects %s to /dashboard", async (path) => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch(path, { cookie });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/dashboard");
	});

	it("allows /dashboard (200)", async () => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/dashboard", { cookie });
		expect(res.status).toBe(200);
	});
});

describe("authenticated admin", () => {
	it.each([
		["/users"],
		["/approve-transactions"],
	])("allows %s (200)", async (path) => {
		const { id } = await seedAdmin();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch(path, { cookie });
		expect(res.status).toBe(200);
	});
});

describe("locals population", () => {
	it("populates context.locals.user for an authenticated request", async () => {
		// Exercised indirectly: /api/transactions requires locals.user and
		// returns 401 without it, 200 with a valid session.
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/transactions", { cookie });
		expect(res.status).toBe(200);
	});

	it("redirects an unauthenticated API request to /login rather than reaching the handler", async () => {
		// /api/transactions isn't a public route or under /api/auth, so
		// middleware redirects before the route handler's own 401 check runs.
		const res = await apiFetch("/api/transactions");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/login");
	});
});

// @vitest-environment node
import { auth } from "@lib/auth";
import { checkDbHealth } from "@lib/db-health";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/auth", () => ({
	auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@lib/db-health", () => ({
	checkDbHealth: vi.fn(),
}));

const { onRequest } = await import("../middleware");

const mockGetSession = vi.mocked(auth.api.getSession);
const mockCheckDbHealth = vi.mocked(checkDbHealth);

beforeEach(() => {
	mockCheckDbHealth.mockResolvedValue(null);
});

function makeContext(pathname: string, opts: { method?: string } = {}) {
	const url = new URL(`http://localhost${pathname}`);
	const request = new Request(url, { method: opts.method ?? "GET" });
	const locals: Record<string, unknown> = {};
	let redirectedTo: string | null = null;
	return {
		context: {
			url,
			request,
			locals,
			redirect: (to: string) => {
				redirectedTo = to;
				return new Response(null, {
					status: 302,
					headers: { Location: to },
				});
			},
		},
		locals,
		getRedirect: () => redirectedTo,
	};
}

const next = vi.fn(async () => new Response("ok", { status: 200 }));

describe("middleware", () => {
	it("allows unauthenticated access to /", async () => {
		mockGetSession.mockResolvedValue(null);
		const { context } = makeContext("/");
		const res = (await onRequest(context as never, next)) as Response;
		expect(res.status).toBe(200);
	});

	it("allows unauthenticated access to /login", async () => {
		mockGetSession.mockResolvedValue(null);
		const { context } = makeContext("/login");
		const res = (await onRequest(context as never, next)) as Response;
		expect(res.status).toBe(200);
	});

	it("redirects unauthenticated requests to /dashboard -> /login", async () => {
		mockGetSession.mockResolvedValue(null);
		const { context, getRedirect } = makeContext("/dashboard");
		await onRequest(context as never, next);
		expect(getRedirect()).toBe("/login");
	});

	it("redirects non-admin requests to /users -> /dashboard", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "u1", role: "user" },
			session: { id: "s1" },
		} as never);
		const { context, getRedirect } = makeContext("/users");
		await onRequest(context as never, next);
		expect(getRedirect()).toBe("/dashboard");
	});

	it("redirects non-admin requests to /transaction-categories -> /dashboard", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "u1", role: "user" },
			session: { id: "s1" },
		} as never);
		const { context, getRedirect } = makeContext("/transaction-categories");
		await onRequest(context as never, next);
		expect(getRedirect()).toBe("/dashboard");
	});

	it("redirects non-admin requests to /import-transactions -> /dashboard", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "u1", role: "user" },
			session: { id: "s1" },
		} as never);
		const { context, getRedirect } = makeContext("/import-transactions");
		await onRequest(context as never, next);
		expect(getRedirect()).toBe("/dashboard");
	});

	it("redirects non-admin requests to /approve-transactions -> /dashboard", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "u1", role: "user" },
			session: { id: "s1" },
		} as never);
		const { context, getRedirect } = makeContext("/approve-transactions");
		await onRequest(context as never, next);
		expect(getRedirect()).toBe("/dashboard");
	});

	it("injects user and session into context.locals for authenticated requests", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "u1", role: "admin", accountBalance: "10.00" },
			session: { id: "s1" },
		} as never);
		const { context, locals } = makeContext("/dashboard");
		await onRequest(context as never, next);
		expect(locals.user).toMatchObject({ id: "u1", role: "admin" });
		expect(locals.session).toEqual({ id: "s1" });
	});

	it("passes through authenticated requests to unprotected routes", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "u1", role: "user" },
			session: { id: "s1" },
		} as never);
		const { context } = makeContext("/dashboard");
		const res = (await onRequest(context as never, next)) as Response;
		expect(res.status).toBe(200);
	});

	it("allows admins through admin-only routes", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "admin", role: "admin" },
			session: { id: "s1" },
		} as never);
		const { context } = makeContext("/users");
		const res = (await onRequest(context as never, next)) as Response;
		expect(res.status).toBe(200);
	});

	describe("database errors", () => {
		it("returns 503 without calling getSession when the DB health check fails", async () => {
			mockCheckDbHealth.mockResolvedValue(
				"Could not connect to the database. Make sure Postgres is running " +
					"and DATABASE_URL in your .env is correct.",
			);
			const { context } = makeContext("/dashboard");
			const res = (await onRequest(context as never, next)) as Response;
			expect(res.status).toBe(503);
			expect(await res.text()).toMatch(/postgres is running/i);
			expect(mockGetSession).not.toHaveBeenCalled();
		});

		it("returns 503 with a clear message when the schema isn't migrated", async () => {
			mockCheckDbHealth.mockResolvedValue(
				"Database schema is not migrated (missing tables). Run `bun run migrate`.",
			);
			const { context } = makeContext("/dashboard");
			const res = (await onRequest(context as never, next)) as Response;
			expect(res.status).toBe(503);
			expect(await res.text()).toMatch(/bun run migrate/);
		});

		it("falls back to catching a getSession rejection if the health check passes but getSession still fails", async () => {
			mockGetSession.mockRejectedValue(
				Object.assign(new Error("connect ECONNREFUSED"), {
					code: "ECONNREFUSED",
				}),
			);
			const { context } = makeContext("/dashboard");
			const res = (await onRequest(context as never, next)) as Response;
			expect(res.status).toBe(503);
			expect(await res.text()).toMatch(/postgres is running/i);
		});

		it("rethrows unrecognized getSession errors", async () => {
			mockGetSession.mockRejectedValue(new Error("something else"));
			const { context } = makeContext("/dashboard");
			await expect(onRequest(context as never, next)).rejects.toThrow(
				"something else",
			);
		});
	});

	describe("demo mode", () => {
		afterEach(() => {
			vi.stubEnv("PUBLIC_DEMO_MODE", "false");
		});

		it("blocks mutating API requests with 403 regardless of auth state", async () => {
			vi.stubEnv("PUBLIC_DEMO_MODE", "true");
			mockGetSession.mockResolvedValue({
				user: { id: "admin", role: "admin" },
				session: { id: "s1" },
			} as never);
			const { context } = makeContext("/api/transactions/single", {
				method: "POST",
			});
			const res = (await onRequest(context as never, next)) as Response;
			expect(res.status).toBe(403);
			expect(next).not.toHaveBeenCalled();
		});

		it("still allows mutating requests to the auth API in demo mode", async () => {
			vi.stubEnv("PUBLIC_DEMO_MODE", "true");
			mockGetSession.mockResolvedValue(null);
			const { context } = makeContext("/api/auth/sign-out", {
				method: "POST",
			});
			const res = (await onRequest(context as never, next)) as Response;
			expect(res.status).toBe(200);
		});

		it("allows GET API requests through in demo mode", async () => {
			vi.stubEnv("PUBLIC_DEMO_MODE", "true");
			mockGetSession.mockResolvedValue({
				user: { id: "admin", role: "admin" },
				session: { id: "s1" },
			} as never);
			const { context } = makeContext("/api/categories", { method: "GET" });
			const res = (await onRequest(context as never, next)) as Response;
			expect(res.status).toBe(200);
		});
	});
});

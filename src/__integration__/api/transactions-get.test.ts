import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import {
	seedAdmin,
	seedCategory,
	seedTransaction,
	seedUser,
} from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9e — API Integration: GET /api/transactions, against real pagination,
// filtering, and role-scoping over an actual Postgres table.

describe("GET /api/transactions", () => {
	// The route handler's own `if (!sessionUser) return 401` is unreachable
	// via a real unauthenticated request — src/middleware.ts redirects any
	// non-public, non-auth-API path (including /api/transactions) to /login
	// before the handler ever runs. Confirmed against the live server rather
	// than assumed, since the mocked Phase 8 unit test calls the handler
	// directly and never observes the middleware layer at all.
	it("redirects to /login for an unauthenticated request (middleware runs first)", async () => {
		const res = await apiFetch("/api/transactions");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/login");
	});

	it("admin receives all transactions; regular user receives only their own", async () => {
		const admin = await seedAdmin();
		const other = await seedUser();
		await seedTransaction({ paidByUserId: admin.id, name: "Admin tx" });
		await seedTransaction({ paidByUserId: other.id, name: "Other tx" });

		const adminCookie = await sessionCookieFor(admin.id);
		const adminRes = await apiFetch("/api/transactions", {
			cookie: adminCookie,
		});
		const adminBody = (await adminRes.json()) as { items: { name: string }[] };
		expect(adminBody.items.map((t) => t.name).sort()).toEqual([
			"Admin tx",
			"Other tx",
		]);

		const userCookie = await sessionCookieFor(other.id);
		const userRes = await apiFetch("/api/transactions", { cookie: userCookie });
		const userBody = (await userRes.json()) as { items: { name: string }[] };
		expect(userBody.items.map((t) => t.name)).toEqual(["Other tx"]);
	});

	it("?status=pending filters by status", async () => {
		const user = await seedUser();
		await seedTransaction({ paidByUserId: user.id, status: "pending" });
		await seedTransaction({ paidByUserId: user.id, status: "completed" });
		const cookie = await sessionCookieFor(user.id);

		const res = await apiFetch("/api/transactions?status=pending", { cookie });
		const body = (await res.json()) as { items: { status: string }[] };
		expect(body.items).toHaveLength(1);
		expect(body.items[0].status).toBe("pending");
	});

	it("?type=deposit filters by type", async () => {
		const user = await seedUser();
		await seedTransaction({ paidByUserId: user.id, type: "deposit" });
		await seedTransaction({ paidByUserId: user.id, type: "withdrawal" });
		const cookie = await sessionCookieFor(user.id);

		const res = await apiFetch("/api/transactions?type=deposit", { cookie });
		const body = (await res.json()) as { items: { type: string }[] };
		expect(body.items).toHaveLength(1);
		expect(body.items[0].type).toBe("deposit");
	});

	it("?categoryId filters by category", async () => {
		const user = await seedUser();
		const cat = await seedCategory();
		await seedTransaction({ paidByUserId: user.id, categoryId: cat.id });
		await seedTransaction({ paidByUserId: user.id, categoryId: null });
		const cookie = await sessionCookieFor(user.id);

		const res = await apiFetch(`/api/transactions?categoryId=${cat.id}`, {
			cookie,
		});
		const body = (await res.json()) as { items: { categoryId: string }[] };
		expect(body.items).toHaveLength(1);
		expect(body.items[0].categoryId).toBe(cat.id);
	});

	it("?dateFrom&dateTo filters by inclusive date range", async () => {
		const user = await seedUser();
		await seedTransaction({
			paidByUserId: user.id,
			name: "Too early",
			date: new Date("2026-01-01"),
		});
		await seedTransaction({
			paidByUserId: user.id,
			name: "In range",
			date: new Date("2026-01-15"),
		});
		await seedTransaction({
			paidByUserId: user.id,
			name: "Too late",
			date: new Date("2026-02-01"),
		});
		const cookie = await sessionCookieFor(user.id);

		const res = await apiFetch(
			"/api/transactions?dateFrom=2026-01-10&dateTo=2026-01-20",
			{ cookie },
		);
		const body = (await res.json()) as { items: { name: string }[] };
		expect(body.items.map((t) => t.name)).toEqual(["In range"]);
	});

	it("?sortBy=date&sortDir=asc sorts ascending", async () => {
		const user = await seedUser();
		await seedTransaction({
			paidByUserId: user.id,
			name: "Later",
			date: new Date("2026-02-01"),
		});
		await seedTransaction({
			paidByUserId: user.id,
			name: "Earlier",
			date: new Date("2026-01-01"),
		});
		const cookie = await sessionCookieFor(user.id);

		const res = await apiFetch("/api/transactions?sortBy=date&sortDir=asc", {
			cookie,
		});
		const body = (await res.json()) as { items: { name: string }[] };
		expect(body.items.map((t) => t.name)).toEqual(["Earlier", "Later"]);
	});

	it("?page=2&pageSize=1 returns the correct page slice and total count", async () => {
		const user = await seedUser();
		await seedTransaction({
			paidByUserId: user.id,
			name: "A",
			date: new Date("2026-01-01"),
		});
		await seedTransaction({
			paidByUserId: user.id,
			name: "B",
			date: new Date("2026-01-02"),
		});
		const cookie = await sessionCookieFor(user.id);

		const res = await apiFetch(
			"/api/transactions?page=2&pageSize=1&sortBy=date&sortDir=asc",
			{ cookie },
		);
		const body = (await res.json()) as {
			items: { name: string }[];
			total: number;
			page: number;
			pageSize: number;
		};
		expect(body.items.map((t) => t.name)).toEqual(["B"]);
		expect(body.total).toBe(2);
		expect(body.page).toBe(2);
		expect(body.pageSize).toBe(1);
	});

	// BUG (found here, not fixed as part of this test-only phase): unlike
	// GET /api/categories, GET /api/users, and GET /api/transactions/groups/pending
	// — which all filter isNull(deletedAt) — src/pages/api/transactions/index.ts
	// builds its `conditions` array with no deletedAt filter at all, so
	// soft-deleted rows (e.g. from a deleted group) still show up in the
	// transaction history listing. Left as `.todo` rather than asserting the
	// buggy behavior as correct; see PLAN.PHASE_9.md for the follow-up.
	it.todo("excludes soft-deleted transactions");

	it("response shape is { items, total, page, pageSize }", async () => {
		const user = await seedUser();
		const cookie = await sessionCookieFor(user.id);

		const res = await apiFetch("/api/transactions", { cookie });
		const body = await res.json();
		expect(body).toMatchObject({ items: [], total: 0, page: 1, pageSize: 25 });
	});
});

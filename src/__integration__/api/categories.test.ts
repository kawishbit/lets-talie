import { transactionCategories } from "@db/schema";
import { fetchUsersAndCategories } from "@lib/queries";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { db, seedAdmin, seedCategory, seedUser } from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9j — API Integration: Categories, full lifecycle against a real DB.

describe("GET /api/categories", () => {
	it("returns all non-deleted categories, paginated", async () => {
		const { id } = await seedUser();
		await seedCategory({ label: "Food" });
		await seedCategory({ label: "Deleted", deletedAt: new Date() });
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/categories", { cookie });
		const body = (await res.json()) as {
			items: { label: string }[];
			total: number;
		};
		expect(body.items.map((c) => c.label)).toEqual(["Food"]);
		expect(body.total).toBe(1);
	});

	// Middleware redirects unauthenticated requests to non-public routes before
	// the handler's own 401 check ever runs — see the equivalent note in
	// transactions-get.test.ts.
	it("redirects to /login for an unauthenticated request (middleware runs first)", async () => {
		const res = await apiFetch("/api/categories");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/login");
	});
});

describe("POST /api/categories", () => {
	it("returns 403 when not admin", async () => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/categories", {
			method: "POST",
			cookie,
			body: { label: "New" },
		});
		expect(res.status).toBe(403);
	});

	it("returns 400 when label is missing", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/categories", {
			method: "POST",
			cookie,
			body: {},
		});
		expect(res.status).toBe(400);
	});

	it("inserts and returns 201; appears in a subsequent GET", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/categories", {
			method: "POST",
			cookie,
			body: { label: "Entertainment" },
		});
		expect(res.status).toBe(201);

		const listRes = await apiFetch("/api/categories", { cookie });
		const listBody = (await listRes.json()) as { items: { label: string }[] };
		expect(listBody.items.map((c) => c.label)).toContain("Entertainment");
	});

	it("allows a duplicate label (no unique constraint)", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		await apiFetch("/api/categories", {
			method: "POST",
			cookie,
			body: { label: "Dup" },
		});
		const secondRes = await apiFetch("/api/categories", {
			method: "POST",
			cookie,
			body: { label: "Dup" },
		});
		expect(secondRes.status).toBe(201);
	});
});

describe("PATCH /api/categories/[id]", () => {
	it("returns 403 when not admin", async () => {
		const { id: userId } = await seedUser();
		const category = await seedCategory();
		const cookie = await sessionCookieFor(userId);

		const res = await apiFetch(`/api/categories/${category.id}`, {
			method: "PATCH",
			cookie,
			body: { label: "New label" },
		});
		expect(res.status).toBe(403);
	});

	it("returns 404 when id does not exist", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/categories/does-not-exist", {
			method: "PATCH",
			cookie,
			body: { label: "New label" },
		});
		expect(res.status).toBe(404);
	});

	it("updates label and it's reflected in GET", async () => {
		const admin = await seedAdmin();
		const category = await seedCategory({ label: "Old label" });
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/categories/${category.id}`, {
			method: "PATCH",
			cookie,
			body: { label: "Updated label" },
		});
		expect(res.status).toBe(200);

		const [row] = await db
			.select()
			.from(transactionCategories)
			.where(eq(transactionCategories.id, category.id));
		expect(row?.label).toBe("Updated label");
	});
});

describe("DELETE /api/categories/[id]", () => {
	it("returns 403 when not admin", async () => {
		const { id: userId } = await seedUser();
		const category = await seedCategory();
		const cookie = await sessionCookieFor(userId);

		const res = await apiFetch(`/api/categories/${category.id}`, {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(403);
	});

	it("returns 404 when id does not exist", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/categories/does-not-exist", {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(404);
	});

	it("soft-deletes and excludes the category from GET + fetchUsersAndCategories", async () => {
		const admin = await seedAdmin();
		const category = await seedCategory({ label: "To delete" });
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/categories/${category.id}`, {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(200);

		const [row] = await db
			.select()
			.from(transactionCategories)
			.where(eq(transactionCategories.id, category.id));
		expect(row?.deletedAt).toBeInstanceOf(Date);

		const listRes = await apiFetch("/api/categories", { cookie });
		const listBody = (await listRes.json()) as { items: { label: string }[] };
		expect(listBody.items.map((c) => c.label)).not.toContain("To delete");

		const { categories } = await fetchUsersAndCategories();
		expect(categories.map((c) => c.label)).not.toContain("To delete");
	});
});

import { user } from "@db/schema";
import { fetchUsersAndCategories } from "@lib/queries";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { db, seedAdmin, seedUser } from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9k — API Integration: Users, full lifecycle against a real DB.

describe("GET /api/users", () => {
	it("returns 403 when not admin", async () => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/users", { cookie });
		expect(res.status).toBe(403);
	});

	it("admin receives paginated list of non-deleted users", async () => {
		const admin = await seedAdmin({ name: "Admin" });
		await seedUser({ name: "Deleted", deletedAt: new Date() });
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/users", { cookie });
		const body = (await res.json()) as { items: { name: string }[] };
		expect(body.items.map((u) => u.name)).toEqual(["Admin"]);
	});

	it("?role=admin and ?role=user filter by role", async () => {
		const admin = await seedAdmin({ name: "Admin A" });
		await seedUser({ name: "User B" });
		const cookie = await sessionCookieFor(admin.id);

		const adminOnly = await apiFetch("/api/users?role=admin", { cookie });
		const adminBody = (await adminOnly.json()) as { items: { name: string }[] };
		expect(adminBody.items.map((u) => u.name)).toEqual(["Admin A"]);

		const usersOnly = await apiFetch("/api/users?role=user", { cookie });
		const usersBody = (await usersOnly.json()) as { items: { name: string }[] };
		expect(usersBody.items.map((u) => u.name)).toEqual(["User B"]);
	});
});

describe("POST /api/users", () => {
	it("returns 403 when not admin", async () => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/users", {
			method: "POST",
			cookie,
			body: { name: "New", email: "new@test.dev" },
		});
		expect(res.status).toBe(403);
	});

	it("returns 400 when email or name is missing", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/users", {
			method: "POST",
			cookie,
			body: { name: "No email" },
		});
		expect(res.status).toBe(400);
	});

	it("inserts and returns 201 on valid input", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/users", {
			method: "POST",
			cookie,
			body: { name: "Fresh User", email: "fresh@test.dev" },
		});
		expect(res.status).toBe(201);

		const [row] = await db
			.select()
			.from(user)
			.where(eq(user.email, "fresh@test.dev"));
		expect(row?.name).toBe("Fresh User");
		expect(row?.role).toBe("user");
	});
});

describe("PATCH /api/users/[id]", () => {
	it("returns 403 when not admin", async () => {
		const { id } = await seedUser();
		const other = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch(`/api/users/${other.id}`, {
			method: "PATCH",
			cookie,
			body: { name: "Renamed" },
		});
		expect(res.status).toBe(403);
	});

	it("returns 404 when id does not exist", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/users/does-not-exist", {
			method: "PATCH",
			cookie,
			body: { name: "Renamed" },
		});
		expect(res.status).toBe(404);
	});

	it("updates name/email/role; change is reflected in DB", async () => {
		const admin = await seedAdmin();
		const target = await seedUser({ name: "Before" });
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/users/${target.id}`, {
			method: "PATCH",
			cookie,
			body: { name: "After", role: "admin" },
		});
		expect(res.status).toBe(200);

		const [row] = await db.select().from(user).where(eq(user.id, target.id));
		expect(row?.name).toBe("After");
		expect(row?.role).toBe("admin");
	});
});

describe("DELETE /api/users/[id]", () => {
	it("returns 403 when not admin", async () => {
		const { id } = await seedUser();
		const other = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch(`/api/users/${other.id}`, {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(403);
	});

	it("cannot delete own account (400)", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/users/${admin.id}`, {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(400);
	});

	it("returns 404 when id does not exist", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/users/does-not-exist", {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(404);
	});

	it("soft-deletes and excludes the user from GET + fetchUsersAndCategories", async () => {
		const admin = await seedAdmin();
		const target = await seedUser({ name: "Goner" });
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/users/${target.id}`, {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(200);

		const [row] = await db.select().from(user).where(eq(user.id, target.id));
		expect(row?.deletedAt).toBeInstanceOf(Date);

		const { users } = await fetchUsersAndCategories();
		expect(users.map((u) => u.name)).not.toContain("Goner");
	});
});

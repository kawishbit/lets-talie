import { user } from "@db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { db, seedAdmin, seedUser } from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9g — API Integration: Single Transactions, full lifecycle against a real DB.

describe("POST /api/transactions/single", () => {
	it("admin's completed deposit updates balance in DB", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/single", {
			method: "POST",
			cookie,
			body: {
				name: "Cash top-up",
				date: "2026-01-10",
				amount: 50,
				paidByUserId: admin.id,
				type: "deposit",
				status: "completed",
			},
		});
		expect(res.status).toBe(201);

		const [row] = await db.select().from(user).where(eq(user.id, admin.id));
		expect(row?.accountBalance).toBe("50.00");
	});

	it("admin's pending withdrawal leaves balance unchanged", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		await apiFetch("/api/transactions/single", {
			method: "POST",
			cookie,
			body: {
				name: "Coffee",
				date: "2026-01-10",
				amount: 5,
				paidByUserId: admin.id,
				type: "withdrawal",
				status: "pending",
			},
		});

		const [row] = await db.select().from(user).where(eq(user.id, admin.id));
		expect(row?.accountBalance).toBe("0.00");
	});

	it("admin's cancelled transaction leaves balance unchanged", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		await apiFetch("/api/transactions/single", {
			method: "POST",
			cookie,
			body: {
				name: "Refunded",
				date: "2026-01-10",
				amount: 5,
				paidByUserId: admin.id,
				type: "withdrawal",
				status: "cancelled",
			},
		});

		const [row] = await db.select().from(user).where(eq(user.id, admin.id));
		expect(row?.accountBalance).toBe("0.00");
	});

	it("regular user's transaction is forced pending even when completed is requested", async () => {
		const user1 = await seedUser();
		const cookie = await sessionCookieFor(user1.id);

		const res = await apiFetch("/api/transactions/single", {
			method: "POST",
			cookie,
			body: {
				name: "Cash top-up",
				date: "2026-01-10",
				amount: 50,
				paidByUserId: user1.id,
				type: "deposit",
				status: "completed",
			},
		});
		expect(res.status).toBe(201);

		// Status is server-enforced, not client-controlled — balance must not move.
		const [row] = await db.select().from(user).where(eq(user.id, user1.id));
		expect(row?.accountBalance).toBe("0.00");

		const listRes = await apiFetch("/api/transactions", { cookie });
		const listBody = (await listRes.json()) as {
			items: { name: string; status: string }[];
		};
		const created = listBody.items.find((t) => t.name === "Cash top-up");
		expect(created?.status).toBe("pending");
	});

	it("inserted transaction appears in GET /api/transactions", async () => {
		const user1 = await seedUser();
		const cookie = await sessionCookieFor(user1.id);

		await apiFetch("/api/transactions/single", {
			method: "POST",
			cookie,
			body: {
				name: "Visible tx",
				date: "2026-01-10",
				amount: 5,
				paidByUserId: user1.id,
				type: "deposit",
				status: "completed",
			},
		});

		const res = await apiFetch("/api/transactions", { cookie });
		const body = (await res.json()) as { items: { name: string }[] };
		expect(body.items.map((t) => t.name)).toContain("Visible tx");
	});

	it("admin can create a single transaction for any paidByUserId", async () => {
		const admin = await seedAdmin();
		const other = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/single", {
			method: "POST",
			cookie,
			body: {
				name: "On behalf of",
				date: "2026-01-10",
				amount: 20,
				paidByUserId: other.id,
				type: "deposit",
				status: "completed",
			},
		});
		expect(res.status).toBe(201);

		const [row] = await db.select().from(user).where(eq(user.id, other.id));
		expect(row?.accountBalance).toBe("20.00");
	});
});

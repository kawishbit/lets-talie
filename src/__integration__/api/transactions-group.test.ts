import { transactions, user } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { db, seedAdmin, seedGroup, seedUser } from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9f — API Integration: Group Transactions, full lifecycle against a real DB.

describe("POST /api/transactions/group", () => {
	it("admin creates a group -> status completed, balances updated in DB", async () => {
		const admin = await seedAdmin();
		const b = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/group", {
			method: "POST",
			cookie,
			body: {
				name: "Dinner",
				date: "2026-01-15",
				amount: 100,
				paidByUserId: admin.id,
				parties: [admin.id, b.id],
			},
		});
		expect(res.status).toBe(201);
		const { groupId } = (await res.json()) as { groupId: string };

		const rows = await db
			.select()
			.from(transactions)
			.where(eq(transactions.transactionGroupId, groupId));
		expect(rows).toHaveLength(3); // 1 deposit + 2 withdrawals
		expect(rows.every((r) => r.status === "completed")).toBe(true);

		const [payerRow] = await db
			.select()
			.from(user)
			.where(eq(user.id, admin.id));
		const [partyRow] = await db.select().from(user).where(eq(user.id, b.id));
		expect(payerRow?.accountBalance).toBe("50.00");
		expect(partyRow?.accountBalance).toBe("-50.00");
	});

	it("regular user creates a group -> status pending, balances unchanged", async () => {
		const payer = await seedUser();
		const other = await seedUser();
		const cookie = await sessionCookieFor(payer.id);

		const res = await apiFetch("/api/transactions/group", {
			method: "POST",
			cookie,
			body: {
				name: "Groceries",
				date: "2026-01-15",
				amount: 40,
				paidByUserId: payer.id,
				parties: [payer.id, other.id],
			},
		});
		expect(res.status).toBe(201);
		const { groupId } = (await res.json()) as { groupId: string };

		const rows = await db
			.select()
			.from(transactions)
			.where(eq(transactions.transactionGroupId, groupId));
		expect(rows.every((r) => r.status === "pending")).toBe(true);

		const [payerRow] = await db
			.select()
			.from(user)
			.where(eq(user.id, payer.id));
		expect(payerRow?.accountBalance).toBe("0.00");
	});

	it("equal-split divides evenly across parties", async () => {
		const admin = await seedAdmin();
		const b = await seedUser();
		const c = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/group", {
			method: "POST",
			cookie,
			body: {
				name: "Uber",
				date: "2026-01-15",
				amount: 30,
				paidByUserId: admin.id,
				parties: [admin.id, b.id, c.id],
			},
		});
		const { groupId } = (await res.json()) as { groupId: string };

		const withdrawals = await db
			.select()
			.from(transactions)
			.where(eq(transactions.transactionGroupId, groupId));
		for (const row of withdrawals.filter((r) => r.type === "withdrawal")) {
			expect(row.amount).toBe("10.00");
		}
	});

	it("custom-split matches supplied customAmounts", async () => {
		const admin = await seedAdmin();
		const b = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/group", {
			method: "POST",
			cookie,
			body: {
				name: "Split bill",
				date: "2026-01-15",
				amount: 100,
				paidByUserId: admin.id,
				parties: [admin.id, b.id],
				customAmounts: { [admin.id]: 70, [b.id]: 30 },
			},
		});
		const { groupId } = (await res.json()) as { groupId: string };

		const rows = await db
			.select()
			.from(transactions)
			.where(eq(transactions.transactionGroupId, groupId));
		const byUser = Object.fromEntries(
			rows
				.filter((r) => r.type === "withdrawal")
				.map((r) => [r.paidByUserId, r.amount]),
		);
		expect(byUser[admin.id]).toBe("70.00");
		expect(byUser[b.id]).toBe("30.00");
	});

	it("rejects custom amounts that don't sum to the total", async () => {
		const admin = await seedAdmin();
		const b = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/group", {
			method: "POST",
			cookie,
			body: {
				name: "Bad split",
				date: "2026-01-15",
				amount: 100,
				paidByUserId: admin.id,
				parties: [admin.id, b.id],
				customAmounts: { [admin.id]: 70, [b.id]: 10 },
			},
		});
		expect(res.status).toBe(400);
	});
});

describe("PATCH /api/transactions/group/[groupId]/status", () => {
	it("approving a pending group sets all transactions to completed and recalculates balances", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const other = await seedUser();
		const { groupId } = await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id, other.id],
			amount: 60,
			status: "pending",
		});
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/transactions/group/${groupId}/status`, {
			method: "PATCH",
			cookie,
			body: { action: "approve" },
		});
		expect(res.status).toBe(200);

		const rows = await db
			.select()
			.from(transactions)
			.where(eq(transactions.transactionGroupId, groupId));
		expect(rows.every((r) => r.status === "completed")).toBe(true);

		const [payerRow] = await db
			.select()
			.from(user)
			.where(eq(user.id, payer.id));
		expect(payerRow?.accountBalance).toBe("30.00");
	});

	it("rejecting a pending group sets transactions to cancelled and leaves balances unchanged", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const { groupId } = await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 20,
			status: "pending",
		});
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/transactions/group/${groupId}/status`, {
			method: "PATCH",
			cookie,
			body: { action: "reject" },
		});
		expect(res.status).toBe(200);

		const rows = await db
			.select()
			.from(transactions)
			.where(eq(transactions.transactionGroupId, groupId));
		expect(rows.every((r) => r.status === "cancelled")).toBe(true);

		const [payerRow] = await db
			.select()
			.from(user)
			.where(eq(user.id, payer.id));
		expect(payerRow?.accountBalance).toBe("0.00");
	});

	it("returns 409 when attempting to update an already-completed group", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const { groupId } = await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 20,
			status: "completed",
		});
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/transactions/group/${groupId}/status`, {
			method: "PATCH",
			cookie,
			body: { action: "approve" },
		});
		expect(res.status).toBe(409);
	});

	it("returns 404 for a non-existent groupId", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(
			"/api/transactions/group/does-not-exist/status",
			{
				method: "PATCH",
				cookie,
				body: { action: "approve" },
			},
		);
		expect(res.status).toBe(404);
	});
});

describe("DELETE /api/transactions/group/[groupId]", () => {
	it("soft-deletes all transactions and reverses balances for a completed group", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const other = await seedUser();
		const { groupId } = await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id, other.id],
			amount: 50,
			status: "completed",
		});
		await recalculateBalances([payer.id, other.id]);
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch(`/api/transactions/group/${groupId}`, {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(200);

		const rows = await db
			.select()
			.from(transactions)
			.where(eq(transactions.transactionGroupId, groupId));
		expect(rows.every((r) => r.deletedAt !== null)).toBe(true);

		const [payerRow] = await db
			.select()
			.from(user)
			.where(eq(user.id, payer.id));
		expect(payerRow?.accountBalance).toBe("0.00");

		// The payer (a regular user) should never see their own deleted rows.
		const payerCookie = await sessionCookieFor(payer.id);
		const listRes = await apiFetch("/api/transactions", {
			cookie: payerCookie,
		});
		const listBody = (await listRes.json()) as { items: unknown[] };
		expect(listBody.items).toEqual([]);
	});

	it("deleting a pending group does not change balances", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const { groupId } = await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 20,
			status: "pending",
		});
		const cookie = await sessionCookieFor(admin.id);

		await apiFetch(`/api/transactions/group/${groupId}`, {
			method: "DELETE",
			cookie,
		});

		const [payerRow] = await db
			.select()
			.from(user)
			.where(eq(user.id, payer.id));
		expect(payerRow?.accountBalance).toBe("0.00");
	});

	it("returns 404 for a non-existent (or already deleted) groupId", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/group/does-not-exist", {
			method: "DELETE",
			cookie,
		});
		expect(res.status).toBe(404);
	});
});

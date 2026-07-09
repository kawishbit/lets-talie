import { transactions, user } from "@db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { db, seedAdmin, seedUser } from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9i — API Integration: POST /api/transactions/import, against a real DB
// transaction (all-or-nothing insert) and real balance recalculation.

describe("POST /api/transactions/import", () => {
	it("valid JSON array import inserts all rows and recalculates balances", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/import", {
			method: "POST",
			cookie,
			headers: { "content-type": "application/json" },
			body: [
				{
					name: "Imported deposit",
					date: "2026-01-10",
					amount: 75,
					paidByUserId: payer.id,
					type: "deposit",
					status: "completed",
				},
			],
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { imported: number };
		expect(body.imported).toBe(1);

		const [row] = await db.select().from(user).where(eq(user.id, payer.id));
		expect(row?.accountBalance).toBe("75.00");
	});

	it("valid CSV import (text/csv) inserts all rows", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const csv = [
			"name,date,amount,paidByUserId,type,status",
			`Imported CSV row,2026-01-10,42.50,${payer.id},withdrawal,completed`,
		].join("\n");

		const res = await apiFetch("/api/transactions/import", {
			method: "POST",
			cookie,
			headers: { "content-type": "text/csv" },
			body: csv,
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { imported: number };
		expect(body.imported).toBe(1);
	});

	it("valid multipart/form-data upload inserts all rows", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const csv = [
			"name,date,amount,paidByUserId,type,status",
			`Multipart row,2026-01-10,10.00,${payer.id},deposit,completed`,
		].join("\n");
		const formData = new FormData();
		formData.set("file", new Blob([csv], { type: "text/csv" }), "import.csv");

		const res = await apiFetch("/api/transactions/import", {
			method: "POST",
			cookie,
			body: formData,
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { imported: number };
		expect(body.imported).toBe(1);
	});

	it("rejects the entire import with 422 when one row is invalid, DB unchanged", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/import", {
			method: "POST",
			cookie,
			headers: { "content-type": "application/json" },
			body: [
				{
					name: "Good row",
					date: "2026-01-10",
					amount: 10,
					paidByUserId: payer.id,
					type: "deposit",
					status: "completed",
				},
				{
					name: "Bad row",
					date: "2026-01-10",
					amount: -5, // invalid: must be positive
					paidByUserId: payer.id,
					type: "deposit",
					status: "completed",
				},
			],
		});
		expect(res.status).toBe(422);
		const body = (await res.json()) as { rowErrors: { row: number }[] };
		expect(body.rowErrors.map((e) => e.row)).toEqual([2]);

		const rows = await db
			.select()
			.from(transactions)
			.where(eq(transactions.paidByUserId, payer.id));
		expect(rows).toHaveLength(0);
	});

	it("preserves transactionGroupId and createdAt when provided", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		const cookie = await sessionCookieFor(admin.id);
		const createdAt = "2025-06-01T00:00:00.000Z";

		const res = await apiFetch("/api/transactions/import", {
			method: "POST",
			cookie,
			headers: { "content-type": "application/json" },
			body: [
				{
					name: "Historical row",
					date: "2026-01-10",
					amount: 10,
					paidByUserId: payer.id,
					type: "deposit",
					status: "completed",
					transactionGroupId: "preserved-group-id",
					createdAt,
				},
			],
		});
		expect(res.status).toBe(201);

		const [row] = await db
			.select()
			.from(transactions)
			.where(eq(transactions.paidByUserId, payer.id));
		expect(row?.transactionGroupId).toBe("preserved-group-id");
		expect(row?.createdAt.toISOString()).toBe(createdAt);
	});

	it("returns 415 for an unsupported Content-Type", async () => {
		const admin = await seedAdmin();
		const cookie = await sessionCookieFor(admin.id);

		const res = await apiFetch("/api/transactions/import", {
			method: "POST",
			cookie,
			headers: { "content-type": "text/plain" },
			body: "not a supported format",
		});
		expect(res.status).toBe(415);
	});

	it("returns 403 for a non-admin user", async () => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/transactions/import", {
			method: "POST",
			cookie,
			headers: { "content-type": "application/json" },
			body: [],
		});
		expect(res.status).toBe(403);
	});
});

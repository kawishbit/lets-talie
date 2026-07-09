// @vitest-environment node
import { db } from "@db/database";
import * as balanceLib from "@lib/balance";
import { POST } from "@pages/api/transactions/import";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../../helpers/db";

vi.mock("@lib/balance", () => ({ recalculateBalances: vi.fn() }));

const mockDb = vi.mocked(db);
const mockRecalculate = vi.mocked(balanceLib.recalculateBalances);

function makeLocals(user: { id: string; role: string } | null) {
	return { user, session: null } as never;
}

function jsonRequest(body: unknown) {
	return new Request("http://localhost/api/transactions/import", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function csvRequest(text: string) {
	return new Request("http://localhost/api/transactions/import", {
		method: "POST",
		headers: { "Content-Type": "text/csv" },
		body: text,
	});
}

function multipartRequest(file?: File) {
	const formData = new FormData();
	if (file) formData.append("file", file);
	return new Request("http://localhost/api/transactions/import", {
		method: "POST",
		body: formData,
	});
}

const validRow = {
	name: "Groceries",
	date: "2026-01-10",
	amount: 42.5,
	paidByUserId: "user-a",
	type: "withdrawal",
	status: "completed",
};

function stubTransaction() {
	const tx = { insert: vi.fn(() => createChain(undefined)) };
	mockDb.transaction.mockImplementation((async (
		cb: (tx: unknown) => Promise<void>,
	) => {
		await cb(tx);
	}) as never);
	return tx;
}

describe("POST /api/transactions/import", () => {
	it("returns 401 when no session exists", async () => {
		const res = await POST({
			locals: makeLocals(null),
			request: jsonRequest([validRow]),
		} as never);
		expect(res.status).toBe(401);
	});

	it("returns 403 when session user is not admin", async () => {
		const res = await POST({
			locals: makeLocals({ id: "u1", role: "user" }),
			request: jsonRequest([validRow]),
		} as never);
		expect(res.status).toBe(403);
	});

	it("returns 415 when Content-Type is unsupported", async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: new Request("http://localhost/api/transactions/import", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: "hello",
			}),
		} as never);
		expect(res.status).toBe(415);
	});

	it("returns 400 when the JSON body is not an array", async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest({ not: "an array" }),
		} as never);
		expect(res.status).toBe(400);
	});

	it("returns 400 when no rows are provided", async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([]),
		} as never);
		expect(res.status).toBe(400);
	});

	it('returns 400 when the "file" field is missing from multipart/form-data', async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: multipartRequest(),
		} as never);
		expect(res.status).toBe(400);
	});

	it("returns 422 with per-row errors when JSON rows fail validation", async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([
				{ ...validRow, name: "" },
				{ ...validRow, amount: -5 },
			]),
		} as never);
		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.rowErrors).toHaveLength(2);
	});

	it("returns 422 with per-row errors when CSV rows fail validation", async () => {
		const csv =
			"name,date,amount,paidByUserId,type,status\n,2026-01-10,42.5,user-a,withdrawal,completed";
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: csvRequest(csv),
		} as never);
		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.rowErrors).toHaveLength(1);
	});

	it("rejects the entire import when any row has a validation error (no partial insert)", async () => {
		const tx = stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([validRow, { ...validRow, name: "" }]),
		} as never);
		expect(res.status).toBe(422);
		expect(mockDb.transaction).not.toHaveBeenCalled();
		expect(tx.insert).not.toHaveBeenCalled();
	});

	it("bulk-inserts all rows inside a DB transaction on valid input", async () => {
		const tx = stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([validRow, { ...validRow, name: "Rent" }]),
		} as never);

		expect(res.status).toBe(201);
		expect(mockDb.transaction).toHaveBeenCalledTimes(1);
		expect(tx.insert).toHaveBeenCalledTimes(2);
	});

	it("calls recalculateBalances for all unique affected users after import", async () => {
		stubTransaction();
		await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([
				validRow,
				{ ...validRow, paidByUserId: "user-a" },
				{ ...validRow, paidByUserId: "user-b" },
			]),
		} as never);

		expect(mockRecalculate).toHaveBeenCalledWith(["user-a", "user-b"]);
	});

	it("does not call recalculateBalances when no imported row is completed", async () => {
		stubTransaction();
		await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, status: "pending" }]),
		} as never);

		expect(mockRecalculate).not.toHaveBeenCalled();
	});

	it("returns 201 with the count of imported transactions on success", async () => {
		stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([validRow, { ...validRow, name: "Rent" }]),
		} as never);

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toEqual({ imported: 2 });
	});

	it("accepts a valid multipart/form-data CSV file upload", async () => {
		stubTransaction();
		const csv =
			"name,date,amount,paidByUserId,type,status\nGroceries,2026-01-10,42.50,user-a,withdrawal,completed";
		const file = new File([csv], "rows.csv", { type: "text/csv" });

		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: multipartRequest(file),
		} as never);

		expect(res.status).toBe(201);
	});
});

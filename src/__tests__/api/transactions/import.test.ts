// @vitest-environment node
import { db } from "@db/database";
import * as balanceLib from "@lib/balance";
import * as queriesLib from "@lib/queries";
import { POST } from "@pages/api/transactions/import";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChain } from "../../helpers/db";

vi.mock("@lib/balance", () => ({ recalculateBalances: vi.fn() }));
vi.mock("@lib/queries", () => ({ fetchUsersAndCategories: vi.fn() }));

const mockDb = vi.mocked(db);
const mockRecalculate = vi.mocked(balanceLib.recalculateBalances);
const mockFetchLookups = vi.mocked(queriesLib.fetchUsersAndCategories);

// Known users/categories the import route resolves references against. Ids like
// "user-a" stand in for UUIDs; names/labels exercise the id-or-name matching.
const lookupUsers = [
	{ id: "user-a", name: "Alice Anderson", email: "alice@x.test" },
	{ id: "user-b", name: "Bob Brown", email: "bob@x.test" },
	{ id: "admin", name: "Admin Root", email: "admin@x.test" },
	{ id: "user-sam1", name: "Sam Taylor", email: "sam1@x.test" },
	{ id: "user-sam2", name: "Sam Rivera", email: "sam2@x.test" },
];
const lookupCategories = [
	{ id: "cat-food", label: "Food" },
	{ id: "cat-travel", label: "Travel" },
];

beforeEach(() => {
	mockFetchLookups.mockResolvedValue({
		users: lookupUsers,
		categories: lookupCategories,
	});
});

function insertedRows(tx: { insert: ReturnType<typeof vi.fn> }) {
	return tx.insert.mock.results.map(
		(r) =>
			(r.value as { values: ReturnType<typeof vi.fn> }).values.mock.calls[0][0],
	);
}

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

	it("defaults createdByUserId to the importing admin when omitted", async () => {
		const tx = stubTransaction();
		await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([validRow]),
		} as never);

		expect(insertedRows(tx)[0].createdByUserId).toBe("admin");
	});

	it("uses the row's createdByUserId when provided", async () => {
		const tx = stubTransaction();
		await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, createdByUserId: "user-b" }]),
		} as never);

		expect(insertedRows(tx)[0].createdByUserId).toBe("user-b");
	});

	it("resolves paidByUserId given as a partial name to the user's id", async () => {
		const tx = stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, paidByUserId: "alice" }]),
		} as never);

		expect(res.status).toBe(201);
		expect(insertedRows(tx)[0].paidByUserId).toBe("user-a");
	});

	it("resolves categoryId given as a label to the category's id", async () => {
		const tx = stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, categoryId: "food" }]),
		} as never);

		expect(res.status).toBe(201);
		expect(insertedRows(tx)[0].categoryId).toBe("cat-food");
	});

	it("resolves createdByUserId given as a name to the user's id", async () => {
		const tx = stubTransaction();
		await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, createdByUserId: "bob" }]),
		} as never);

		expect(insertedRows(tx)[0].createdByUserId).toBe("user-b");
	});

	it("recalculates balances against the resolved (not the raw) paidByUserId", async () => {
		stubTransaction();
		await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, paidByUserId: "alice" }]),
		} as never);

		expect(mockRecalculate).toHaveBeenCalledWith(["user-a"]);
	});

	it("returns 422 when a reference name matches no record", async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, paidByUserId: "nobody" }]),
		} as never);

		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.rowErrors).toHaveLength(1);
		expect(json.rowErrors[0].errors[0]).toContain("did not match any user");
	});

	it("returns 422 when a reference name is ambiguous", async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest([{ ...validRow, paidByUserId: "sam" }]),
		} as never);

		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.rowErrors[0].errors[0]).toContain("matches multiple users");
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

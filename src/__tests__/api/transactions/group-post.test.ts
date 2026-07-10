// @vitest-environment node
import { db } from "@db/database";
import * as balanceLib from "@lib/balance";
import { POST } from "@pages/api/transactions/group/index";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../../helpers/db";

vi.mock("@lib/balance", () => ({ recalculateBalances: vi.fn() }));

const mockDb = vi.mocked(db);
const mockRecalculate = vi.mocked(balanceLib.recalculateBalances);

function makeRequest(body: unknown) {
	return new Request("http://localhost/api/transactions/group", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function makeLocals(user: { id: string; role: string } | null) {
	return { user, session: null } as never;
}

function stubInsert() {
	const insertChain = createChain(undefined);
	mockDb.insert.mockReturnValue(insertChain as never);
	return insertChain;
}

function stubTransaction() {
	const tx = { insert: vi.fn(() => stubInsert()) };
	mockDb.transaction.mockImplementation((async (
		cb: (tx: unknown) => Promise<void>,
	) => {
		await cb(tx);
	}) as never);
	return tx;
}

const validBody = {
	name: "Dinner",
	date: "2026-01-15",
	amount: 30,
	paidByUserId: "user-a",
	parties: ["user-a", "user-b", "user-c"],
};

describe("POST /api/transactions/group", () => {
	it("returns 401 when no session exists", async () => {
		const res = await POST({
			locals: makeLocals(null),
			request: makeRequest(validBody),
		} as never);
		expect(res.status).toBe(401);
	});

	it.each([
		["name", { ...validBody, name: "" }],
		["date", { ...validBody, date: "" }],
		["amount", { ...validBody, amount: "30" }],
		["paidByUserId", { ...validBody, paidByUserId: "" }],
		["parties", { ...validBody, parties: [] }],
	])("returns 400 when %s is missing or invalid", async (_field, body) => {
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest(body),
		} as never);
		expect(res.status).toBe(400);
	});

	it("returns 400 when amount is not a positive number", async () => {
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest({ ...validBody, amount: -5 }),
		} as never);
		expect(res.status).toBe(400);
	});

	it("returns 400 when paidByUserId is not included in parties", async () => {
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest({ ...validBody, paidByUserId: "user-z" }),
		} as never);
		expect(res.status).toBe(400);
	});

	it("returns 400 when the date string is not a valid date", async () => {
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest({ ...validBody, date: "not-a-date" }),
		} as never);
		expect(res.status).toBe(400);
	});

	it("returns 400 when custom amounts do not sum to the total amount", async () => {
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest({
				...validBody,
				customAmounts: { "user-a": 10, "user-b": 10, "user-c": 5 },
			}),
		} as never);
		expect(res.status).toBe(400);
	});

	it("returns 400 when a custom amount for any party is negative", async () => {
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest({
				...validBody,
				customAmounts: { "user-a": 40, "user-b": -10, "user-c": 0 },
			}),
		} as never);
		expect(res.status).toBe(400);
	});

	it("inserts 1 deposit + N withdrawals for an equal split", async () => {
		const tx = stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "admin" }),
			request: makeRequest(validBody),
		} as never);

		expect(res.status).toBe(201);
		expect(tx.insert).toHaveBeenCalledTimes(4); // 1 deposit + 3 withdrawals
	});

	it("inserts 1 deposit + N withdrawals honoring custom amounts", async () => {
		const tx = stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "admin" }),
			request: makeRequest({
				...validBody,
				customAmounts: { "user-a": 20, "user-b": 5, "user-c": 5 },
			}),
		} as never);

		expect(res.status).toBe(201);
		const insertChain = tx.insert.mock.results[1].value;
		expect(insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({ amount: "20.00" }),
		);
	});

	it("sets status completed and calls recalculateBalances for an admin", async () => {
		stubTransaction();
		await POST({
			locals: makeLocals({ id: "user-a", role: "admin" }),
			request: makeRequest(validBody),
		} as never);

		expect(mockRecalculate).toHaveBeenCalledWith([
			"user-a",
			"user-a",
			"user-b",
			"user-c",
		]);
	});

	it("sets status pending and skips recalculateBalances for a regular user", async () => {
		const tx = stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest(validBody),
		} as never);

		expect(res.status).toBe(201);
		expect(mockRecalculate).not.toHaveBeenCalled();
		const insertChain = tx.insert.mock.results[0].value;
		expect(insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});

	it("shares the same transactionGroupId across all inserted rows", async () => {
		const tx = stubTransaction();
		await POST({
			locals: makeLocals({ id: "user-a", role: "admin" }),
			request: makeRequest(validBody),
		} as never);

		const groupIds = tx.insert.mock.results.map((r) => {
			const insertChain = r.value as {
				values: { mock: { calls: unknown[][] } };
			};
			return (
				insertChain.values.mock.calls[0][0] as { transactionGroupId: string }
			).transactionGroupId;
		});
		expect(new Set(groupIds).size).toBe(1);
	});

	it("returns 201 with { groupId } on success", async () => {
		stubTransaction();
		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "admin" }),
			request: makeRequest(validBody),
		} as never);

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toHaveProperty("groupId");
		expect(typeof json.groupId).toBe("string");
	});
});

// @vitest-environment node
import { db } from "@db/database";
import * as balanceLib from "@lib/balance";
import { POST } from "@pages/api/transactions/single";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../../helpers/db";

vi.mock("@lib/balance", () => ({ recalculateBalances: vi.fn() }));

const mockDb = vi.mocked(db);
const mockRecalculate = vi.mocked(balanceLib.recalculateBalances);

function makeRequest(body: unknown) {
	return new Request("http://localhost/api/transactions/single", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function makeLocals(user: { id: string; role: string } | null) {
	return { user, session: null } as never;
}

const validBody = {
	name: "Adjustment",
	date: "2026-01-15",
	amount: 20,
	paidByUserId: "user-a",
	type: "deposit",
	status: "completed",
};

describe("POST /api/transactions/single", () => {
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
		["amount", { ...validBody, amount: "20" }],
		["paidByUserId", { ...validBody, paidByUserId: "" }],
		["type", { ...validBody, type: "invalid" }],
		["status", { ...validBody, status: "invalid" }],
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
			request: makeRequest({ ...validBody, amount: 0 }),
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

	it("inserts a single transaction record on valid input", async () => {
		const insertChain = createChain(undefined);
		mockDb.insert.mockReturnValue(insertChain as never);

		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest(validBody),
		} as never);

		expect(res.status).toBe(201);
		expect(mockDb.insert).toHaveBeenCalledTimes(1);
		expect(insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Adjustment",
				amount: "20.00",
				type: "deposit",
				status: "completed",
				paidByUserId: "user-a",
				transactionGroupId: null,
			}),
		);
	});

	it("calls recalculateBalances only when status is completed", async () => {
		mockDb.insert.mockReturnValue(createChain(undefined) as never);

		await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest({ ...validBody, status: "completed" }),
		} as never);

		expect(mockRecalculate).toHaveBeenCalledWith(["user-a"]);
	});

	it.each([
		"pending",
		"cancelled",
	])("does not call recalculateBalances when status is %s", async (status) => {
		mockDb.insert.mockReturnValue(createChain(undefined) as never);

		await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest({ ...validBody, status }),
		} as never);

		expect(mockRecalculate).not.toHaveBeenCalled();
	});

	it("returns 201 with { id } on success", async () => {
		mockDb.insert.mockReturnValue(createChain(undefined) as never);

		const res = await POST({
			locals: makeLocals({ id: "user-a", role: "user" }),
			request: makeRequest(validBody),
		} as never);

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toHaveProperty("id");
		expect(typeof json.id).toBe("string");
	});
});

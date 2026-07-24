// @vitest-environment node
import { db } from "@db/database";
import * as balanceLib from "@lib/balance";
import { PATCH } from "@pages/api/transactions/[id]";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../../helpers/db";

vi.mock("@lib/balance", () => ({ recalculateBalances: vi.fn() }));

const mockDb = vi.mocked(db);
const mockRecalculate = vi.mocked(balanceLib.recalculateBalances);

function makeRequest(body: unknown) {
	return new Request("http://localhost/api/transactions/tx-1", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function makeCtx(
	user: { id: string; role: string } | null,
	body: unknown,
	id = "tx-1",
) {
	return {
		locals: { user, session: null },
		request: makeRequest(body),
		params: { id },
	} as never;
}

const singleCompleted = {
	id: "tx-1",
	transactionGroupId: null,
	name: "Adjustment",
	date: new Date("2026-01-15"),
	remarks: null,
	amount: "20.00",
	type: "deposit",
	status: "completed",
	paidByUserId: "user-a",
	categoryId: null,
	createdByUserId: "user-a",
	lastUpdatedByUserId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
};

describe("PATCH /api/transactions/[id]", () => {
	it("returns 401 when no session exists", async () => {
		const res = await PATCH(makeCtx(null, { name: "X" }));
		expect(res.status).toBe(401);
	});

	it("returns 403 when session user is not admin", async () => {
		const res = await PATCH(makeCtx({ id: "u1", role: "user" }, { name: "X" }));
		expect(res.status).toBe(403);
	});

	it("returns 400 when body has no fields", async () => {
		const res = await PATCH(makeCtx({ id: "admin-1", role: "admin" }, {}));
		expect(res.status).toBe(400);
	});

	it("returns 404 when transaction does not exist", async () => {
		mockDb.select.mockReturnValue(createChain([]) as never);
		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { name: "X" }),
		);
		expect(res.status).toBe(404);
	});

	it("allows updating a row that shares a transactionGroupId", async () => {
		mockDb.select.mockReturnValue(
			createChain([
				{ ...singleCompleted, transactionGroupId: "group-1" },
			]) as never,
		);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { name: "Updated split row" }),
		);
		expect(res.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Updated split row" }),
		);
	});

	it("returns 400 when amount is not positive", async () => {
		mockDb.select.mockReturnValue(createChain([singleCompleted]) as never);
		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { amount: 0 }),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when type is invalid", async () => {
		mockDb.select.mockReturnValue(createChain([singleCompleted]) as never);
		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { type: "transfer" }),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when status is invalid", async () => {
		mockDb.select.mockReturnValue(createChain([singleCompleted]) as never);
		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { status: "done" }),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when date is invalid", async () => {
		mockDb.select.mockReturnValue(createChain([singleCompleted]) as never);
		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { date: "not-a-date" }),
		);
		expect(res.status).toBe(400);
	});

	it("updates fields on a valid single transaction", async () => {
		mockDb.select.mockReturnValue(createChain([singleCompleted]) as never);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		const res = await PATCH(
			makeCtx(
				{ id: "admin-1", role: "admin" },
				{
					name: "Updated",
					amount: 42.5,
					type: "withdrawal",
					status: "completed",
					paidByUserId: "user-b",
					remarks: "note",
					categoryId: "cat-1",
				},
			),
		);

		expect(res.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Updated",
				amount: "42.50",
				type: "withdrawal",
				status: "completed",
				paidByUserId: "user-b",
				remarks: "note",
				categoryId: "cat-1",
				lastUpdatedByUserId: "admin-1",
			}),
		);
		const json = await res.json();
		expect(json).toEqual({ id: "tx-1" });
	});

	it("recalculates old and new payer when completed paidBy changes", async () => {
		mockDb.select.mockReturnValue(createChain([singleCompleted]) as never);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { paidByUserId: "user-b" }),
		);

		expect(mockRecalculate).toHaveBeenCalledWith(
			expect.arrayContaining(["user-a", "user-b"]),
		);
		expect(mockRecalculate.mock.calls[0][0]).toHaveLength(2);
	});

	it("recalculates when a completed transaction is cancelled", async () => {
		mockDb.select.mockReturnValue(createChain([singleCompleted]) as never);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { status: "cancelled" }),
		);

		expect(mockRecalculate).toHaveBeenCalledWith(["user-a"]);
	});

	it("does not recalculate when pending stays non-completed", async () => {
		mockDb.select.mockReturnValue(
			createChain([{ ...singleCompleted, status: "pending" }]) as never,
		);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { name: "Still pending" }),
		);

		expect(mockRecalculate).not.toHaveBeenCalled();
	});

	it("recalculates when pending is marked completed", async () => {
		mockDb.select.mockReturnValue(
			createChain([{ ...singleCompleted, status: "pending" }]) as never,
		);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { status: "completed" }),
		);

		expect(mockRecalculate).toHaveBeenCalledWith(["user-a"]);
	});
});

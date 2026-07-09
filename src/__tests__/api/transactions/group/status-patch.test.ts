// @vitest-environment node
import { db } from "@db/database";
import * as balanceLib from "@lib/balance";
import { PATCH } from "@pages/api/transactions/group/[groupId]/status";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../../../helpers/db";

vi.mock("@lib/balance", () => ({ recalculateBalances: vi.fn() }));

const mockDb = vi.mocked(db);
const mockRecalculate = vi.mocked(balanceLib.recalculateBalances);

function makeRequest(body: unknown) {
	return new Request("http://localhost/api/transactions/group/g1/status", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function makeCtx(
	user: { id: string; role: string } | null,
	body: unknown,
	groupId = "g1",
) {
	return {
		locals: { user, session: null },
		request: makeRequest(body),
		params: { groupId },
	} as never;
}

const pendingRows = [
	{ paidByUserId: "user-a", status: "pending" },
	{ paidByUserId: "user-b", status: "pending" },
];

describe("PATCH /api/transactions/group/[groupId]/status", () => {
	it("returns 401 when no session exists", async () => {
		const res = await PATCH(makeCtx(null, { action: "approve" }));
		expect(res.status).toBe(401);
	});

	it("returns 403 when session user is not admin", async () => {
		const res = await PATCH(
			makeCtx({ id: "u1", role: "user" }, { action: "approve" }),
		);
		expect(res.status).toBe(403);
	});

	it('returns 400 when action is not "approve" or "reject"', async () => {
		const res = await PATCH(
			makeCtx({ id: "u1", role: "admin" }, { action: "delete" }),
		);
		expect(res.status).toBe(400);
	});

	it("returns 404 when groupId does not exist", async () => {
		mockDb.select.mockReturnValue(createChain([]) as never);
		const res = await PATCH(
			makeCtx({ id: "u1", role: "admin" }, { action: "approve" }),
		);
		expect(res.status).toBe(404);
	});

	it("returns 409 when the group has no pending transactions", async () => {
		mockDb.select.mockReturnValue(
			createChain([{ paidByUserId: "user-a", status: "completed" }]) as never,
		);
		const res = await PATCH(
			makeCtx({ id: "u1", role: "admin" }, { action: "approve" }),
		);
		expect(res.status).toBe(409);
	});

	it('sets all group transactions to "completed" and recalculates balances on approve', async () => {
		mockDb.select.mockReturnValue(createChain(pendingRows) as never);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { action: "approve" }),
		);

		expect(res.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: "completed" }),
		);
		expect(mockRecalculate).toHaveBeenCalledWith(["user-a", "user-b"]);
	});

	it('sets all group transactions to "cancelled" and skips recalculateBalances on reject', async () => {
		mockDb.select.mockReturnValue(createChain(pendingRows) as never);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { action: "reject" }),
		);

		expect(res.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: "cancelled" }),
		);
		expect(mockRecalculate).not.toHaveBeenCalled();
	});

	it("returns 200 with { groupId, status } on success", async () => {
		mockDb.select.mockReturnValue(createChain(pendingRows) as never);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		const res = await PATCH(
			makeCtx({ id: "admin-1", role: "admin" }, { action: "approve" }, "g42"),
		);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ groupId: "g42", status: "completed" });
	});
});

// @vitest-environment node
import { db } from "@db/database";
import * as balanceLib from "@lib/balance";
import { DELETE } from "@pages/api/transactions/group/[groupId]/index";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../../../helpers/db";

vi.mock("@lib/balance", () => ({ recalculateBalances: vi.fn() }));

const mockDb = vi.mocked(db);
const mockRecalculate = vi.mocked(balanceLib.recalculateBalances);

function makeCtx(user: { id: string; role: string } | null, groupId = "g1") {
	return {
		locals: { user, session: null },
		params: { groupId },
	} as never;
}

describe("DELETE /api/transactions/group/[groupId]", () => {
	it("returns 401 when no session exists", async () => {
		const res = await DELETE(makeCtx(null));
		expect(res.status).toBe(401);
	});

	it("returns 403 when session user is not admin", async () => {
		const res = await DELETE(makeCtx({ id: "u1", role: "user" }));
		expect(res.status).toBe(403);
	});

	it("returns 404 when groupId does not exist", async () => {
		mockDb.select.mockReturnValue(createChain([]) as never);
		const res = await DELETE(makeCtx({ id: "u1", role: "admin" }));
		expect(res.status).toBe(404);
	});

	it("sets deletedAt on all transactions in the group", async () => {
		mockDb.select.mockReturnValue(
			createChain([{ paidByUserId: "user-a", status: "pending" }]) as never,
		);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		const res = await DELETE(makeCtx({ id: "admin-1", role: "admin" }));

		expect(res.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ deletedAt: expect.any(Date) }),
		);
	});

	it("calls recalculateBalances when the deleted group was completed", async () => {
		mockDb.select.mockReturnValue(
			createChain([
				{ paidByUserId: "user-a", status: "completed" },
				{ paidByUserId: "user-b", status: "completed" },
			]) as never,
		);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await DELETE(makeCtx({ id: "admin-1", role: "admin" }));

		expect(mockRecalculate).toHaveBeenCalledWith(["user-a", "user-b"]);
	});

	it.each([
		"pending",
		"cancelled",
	])("does not call recalculateBalances when the deleted group was %s", async (status) => {
		mockDb.select.mockReturnValue(
			createChain([{ paidByUserId: "user-a", status }]) as never,
		);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await DELETE(makeCtx({ id: "admin-1", role: "admin" }));

		expect(mockRecalculate).not.toHaveBeenCalled();
	});

	it("returns 200 on success", async () => {
		mockDb.select.mockReturnValue(
			createChain([{ paidByUserId: "user-a", status: "pending" }]) as never,
		);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		const res = await DELETE(makeCtx({ id: "admin-1", role: "admin" }));

		expect(res.status).toBe(200);
	});
});

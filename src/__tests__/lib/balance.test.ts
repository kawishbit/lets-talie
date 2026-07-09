// @vitest-environment node
import { db } from "@db/database";
import { recalculateBalances } from "@lib/balance";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../helpers/db";

const mockDb = vi.mocked(db);

describe("recalculateBalances", () => {
	it("skips update entirely when userIds is empty", async () => {
		await recalculateBalances([]);
		expect(mockDb.select).not.toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("deduplicates userIds before querying", async () => {
		mockDb.select.mockReturnValue(createChain([{ balance: "10.00" }]) as never);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await recalculateBalances(["user-1", "user-1", "user-1"]);

		expect(mockDb.select).toHaveBeenCalledTimes(1);
		expect(mockDb.update).toHaveBeenCalledTimes(1);
	});

	it("computes a positive balance when deposits exceed withdrawals", async () => {
		mockDb.select.mockReturnValue(createChain([{ balance: "25.50" }]) as never);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		await recalculateBalances(["user-1"]);

		expect(updateChain.set).toHaveBeenCalledWith({ accountBalance: "25.50" });
	});

	it("computes a negative balance when withdrawals exceed deposits", async () => {
		mockDb.select.mockReturnValue(
			createChain([{ balance: "-15.00" }]) as never,
		);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		await recalculateBalances(["user-1"]);

		expect(updateChain.set).toHaveBeenCalledWith({ accountBalance: "-15.00" });
	});

	it('falls back to "0.00" when the user has no completed transactions', async () => {
		mockDb.select.mockReturnValue(createChain([{ balance: null }]) as never);
		const updateChain = createChain(undefined);
		mockDb.update.mockReturnValue(updateChain as never);

		await recalculateBalances(["user-1"]);

		expect(updateChain.set).toHaveBeenCalledWith({ accountBalance: "0.00" });
	});

	it("applies a where filter to the balance query", async () => {
		const selectChain = createChain([{ balance: "0.00" }]);
		mockDb.select.mockReturnValue(selectChain as never);
		mockDb.update.mockReturnValue(createChain(undefined) as never);

		await recalculateBalances(["user-1"]);

		expect(selectChain.where).toHaveBeenCalledTimes(1);
		expect(selectChain.where.mock.calls[0][0]).toBeTruthy();
	});

	it("handles multiple userIds, issuing one select+update pair per user", async () => {
		mockDb.select
			.mockReturnValueOnce(createChain([{ balance: "10.00" }]) as never)
			.mockReturnValueOnce(createChain([{ balance: "-5.00" }]) as never);
		const updateChainA = createChain(undefined);
		const updateChainB = createChain(undefined);
		mockDb.update
			.mockReturnValueOnce(updateChainA as never)
			.mockReturnValueOnce(updateChainB as never);

		await recalculateBalances(["user-a", "user-b"]);

		expect(mockDb.select).toHaveBeenCalledTimes(2);
		expect(updateChainA.set).toHaveBeenCalledWith({ accountBalance: "10.00" });
		expect(updateChainB.set).toHaveBeenCalledWith({ accountBalance: "-5.00" });
	});
});

import { transactionCategories, transactions, user } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import { fetchUsersAndCategories } from "@lib/queries";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, seedCategory, seedTransaction, seedUser } from "../helpers/db";

// 9b — Database Layer Integration. Runs against a real Postgres (see
// vitest.integration.config.ts / globalSetup.ts), so these verify things a
// mocked unit test can't: real constraints, real column round-tripping, real
// aggregate SQL.

describe("migrations", () => {
	it("apply cleanly and produce the expected tables", async () => {
		const rows = await db.execute<{ table_name: string }>(
			sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
		);
		const tableNames = rows.map((r) => r.table_name).sort();
		expect(tableNames).toEqual(
			[
				"account",
				"session",
				"transaction_categories",
				"transactions",
				"user",
				"verification",
			].sort(),
		);
	});
});

describe("user table", () => {
	it("round-trips insert, read, update, soft-delete", async () => {
		const { id } = await seedUser({ name: "Alice", email: "alice@test.dev" });

		const [inserted] = await db.select().from(user).where(eq(user.id, id));
		expect(inserted?.name).toBe("Alice");
		expect(inserted?.email).toBe("alice@test.dev");
		expect(inserted?.deletedAt).toBeNull();

		await db.update(user).set({ name: "Alice B." }).where(eq(user.id, id));
		const [updated] = await db.select().from(user).where(eq(user.id, id));
		expect(updated?.name).toBe("Alice B.");

		const now = new Date();
		await db.update(user).set({ deletedAt: now }).where(eq(user.id, id));
		const [deleted] = await db.select().from(user).where(eq(user.id, id));
		expect(deleted?.deletedAt).toBeInstanceOf(Date);
	});
});

describe("transactionCategories table", () => {
	it("round-trips insert, read, soft-delete", async () => {
		const { id } = await seedCategory({ label: "Food" });

		const [inserted] = await db
			.select()
			.from(transactionCategories)
			.where(eq(transactionCategories.id, id));
		expect(inserted?.label).toBe("Food");

		const now = new Date();
		await db
			.update(transactionCategories)
			.set({ deletedAt: now })
			.where(eq(transactionCategories.id, id));
		const [deleted] = await db
			.select()
			.from(transactionCategories)
			.where(eq(transactionCategories.id, id));
		expect(deleted?.deletedAt).toBeInstanceOf(Date);
	});
});

describe("transactions table", () => {
	it("inserts with all required fields and reads back matching values", async () => {
		const payer = await seedUser();
		const category = await seedCategory();
		const { id } = await seedTransaction({
			name: "Groceries",
			amount: "42.50",
			type: "withdrawal",
			status: "completed",
			paidByUserId: payer.id,
			categoryId: category.id,
		});

		const [row] = await db
			.select()
			.from(transactions)
			.where(eq(transactions.id, id));
		expect(row?.name).toBe("Groceries");
		expect(row?.amount).toBe("42.50");
		expect(row?.type).toBe("withdrawal");
		expect(row?.paidByUserId).toBe(payer.id);
		expect(row?.categoryId).toBe(category.id);
	});

	it("rejects insert with a non-existent paidByUserId (FK violation)", async () => {
		await expect(
			seedTransaction({ paidByUserId: "does-not-exist" }),
		).rejects.toThrow();
	});

	it("rejects insert with a non-existent categoryId (FK violation)", async () => {
		const payer = await seedUser();
		await expect(
			seedTransaction({
				paidByUserId: payer.id,
				categoryId: "does-not-exist",
			}),
		).rejects.toThrow();
	});
});

describe("recalculateBalances against a real DB", () => {
	it("computes a positive balance from completed deposits/withdrawals", async () => {
		const payer = await seedUser();
		await seedTransaction({
			paidByUserId: payer.id,
			type: "deposit",
			amount: "100.00",
			status: "completed",
		});
		await seedTransaction({
			paidByUserId: payer.id,
			type: "withdrawal",
			amount: "30.00",
			status: "completed",
		});

		await recalculateBalances([payer.id]);

		const [row] = await db.select().from(user).where(eq(user.id, payer.id));
		expect(row?.accountBalance).toBe("70.00");
	});

	it("computes a negative balance when withdrawals exceed deposits", async () => {
		const payer = await seedUser();
		await seedTransaction({
			paidByUserId: payer.id,
			type: "withdrawal",
			amount: "50.00",
			status: "completed",
		});

		await recalculateBalances([payer.id]);

		const [row] = await db.select().from(user).where(eq(user.id, payer.id));
		expect(row?.accountBalance).toBe("-50.00");
	});

	it("ignores soft-deleted and non-completed transactions", async () => {
		const payer = await seedUser();
		await seedTransaction({
			paidByUserId: payer.id,
			type: "deposit",
			amount: "100.00",
			status: "completed",
		});
		await seedTransaction({
			paidByUserId: payer.id,
			type: "deposit",
			amount: "999.00",
			status: "pending",
		});
		await seedTransaction({
			paidByUserId: payer.id,
			type: "deposit",
			amount: "999.00",
			status: "completed",
			deletedAt: new Date(),
		});

		await recalculateBalances([payer.id]);

		const [row] = await db.select().from(user).where(eq(user.id, payer.id));
		expect(row?.accountBalance).toBe("100.00");
	});
});

describe("fetchUsersAndCategories against a real DB", () => {
	it("returns only non-deleted records, ordered ascending", async () => {
		await seedUser({ name: "Zed" });
		await seedUser({ name: "Amy" });
		await seedUser({ name: "Deleted Dan", deletedAt: new Date() });
		await seedCategory({ label: "Zzz Category" });
		await seedCategory({ label: "Aaa Category" });
		await seedCategory({ label: "Deleted Category", deletedAt: new Date() });

		const { users, categories } = await fetchUsersAndCategories();

		expect(users.map((u) => u.name)).toEqual(["Amy", "Zed"]);
		expect(categories.map((c) => c.label)).toEqual([
			"Aaa Category",
			"Zzz Category",
		]);
	});

	it("returns empty arrays when tables are empty", async () => {
		const { users, categories } = await fetchUsersAndCategories();
		expect(users).toEqual([]);
		expect(categories).toEqual([]);
	});
});

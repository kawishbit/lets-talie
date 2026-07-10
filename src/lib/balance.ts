import { db } from "@db/database";
import { transactions, user } from "@db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

/**
 * Recomputes accountBalance for each userId from completed, non-deleted
 * transactions and persists the result to the user table.
 *
 * Balance = SUM(deposits) - SUM(withdrawals) where paidByUserId = userId
 */
export async function recalculateBalances(userIds: string[]): Promise<void> {
	if (userIds.length === 0) return;

	const uniqueIds = [...new Set(userIds)];

	for (const userId of uniqueIds) {
		const [result] = await db
			.select({
				balance: sql<string>`COALESCE(SUM(
          CASE WHEN ${transactions.type} = 'deposit'
            THEN ${transactions.amount}::numeric
            ELSE -(${transactions.amount}::numeric)
          END
        ), 0.00)`,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.paidByUserId, userId),
					eq(transactions.status, "completed"),
					isNull(transactions.deletedAt),
				),
			);

		// Postgres returns "0" (not "0.00") from COALESCE's fallback when SUM
		// aggregates zero rows — normalize to the same x.xx format every other
		// balance value uses, rather than trusting the raw driver string.
		const balance = Number(result?.balance ?? 0).toFixed(2);

		await db
			.update(user)
			.set({ accountBalance: balance })
			.where(eq(user.id, userId));
	}
}

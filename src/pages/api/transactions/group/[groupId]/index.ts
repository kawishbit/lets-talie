import { db } from "@db/database";
import { transactions } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";

export const DELETE: APIRoute = async ({ locals, params }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	const { groupId } = params;
	if (!groupId) {
		return Response.json({ error: "Missing groupId" }, { status: 400 });
	}

	// Fetch current group transactions (non-deleted)
	const groupTxs = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.transactionGroupId, groupId),
				isNull(transactions.deletedAt),
			),
		);

	if (groupTxs.length === 0) {
		return Response.json({ error: "Group not found" }, { status: 404 });
	}

	const wasCompleted = groupTxs.some((tx) => tx.status === "completed");
	const now = new Date();

	// Soft-delete all rows in the group
	await db
		.update(transactions)
		.set({
			deletedAt: now,
			updatedAt: now,
			lastUpdatedByUserId: sessionUser.id,
		})
		.where(
			and(
				eq(transactions.transactionGroupId, groupId),
				isNull(transactions.deletedAt),
			),
		);

	// Reverse balance impact if the group was completed
	if (wasCompleted) {
		const affectedUserIds = [...new Set(groupTxs.map((tx) => tx.paidByUserId))];
		await recalculateBalances(affectedUserIds);
	}

	return Response.json({ groupId, deleted: true });
};

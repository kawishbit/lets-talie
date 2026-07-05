import { db } from "@db/database";
import { transactions } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";

export const PATCH: APIRoute = async ({ locals, request, params }) => {
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

	let body: { action: "approve" | "reject" };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!["approve", "reject"].includes(body.action)) {
		return Response.json(
			{ error: 'action must be "approve" or "reject"' },
			{ status: 400 },
		);
	}

	// Fetch current group transactions (non-deleted, pending)
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

	const hasPending = groupTxs.some((tx) => tx.status === "pending");
	if (!hasPending) {
		return Response.json(
			{ error: "Group has no pending transactions to update" },
			{ status: 409 },
		);
	}

	const newStatus = body.action === "approve" ? "completed" : "cancelled";
	const now = new Date();

	await db
		.update(transactions)
		.set({
			status: newStatus,
			updatedAt: now,
			lastUpdatedByUserId: sessionUser.id,
		})
		.where(
			and(
				eq(transactions.transactionGroupId, groupId),
				isNull(transactions.deletedAt),
			),
		);

	if (newStatus === "completed") {
		const affectedUserIds = [...new Set(groupTxs.map((tx) => tx.paidByUserId))];
		await recalculateBalances(affectedUserIds);
	}

	return Response.json({ groupId, status: newStatus });
};

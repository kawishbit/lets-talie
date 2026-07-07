import { db } from "@db/database";
import { transactionCategories, transactions, user } from "@db/schema";
import type { APIRoute } from "astro";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 20;

export const GET: APIRoute = async ({ locals, url }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
	const pageSize = Math.min(
		100,
		Math.max(
			1,
			parseInt(
				url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
				10,
			),
		),
	);
	const offset = (page - 1) * pageSize;

	// Step 1: Get distinct pending group IDs (paginated)
	const pendingGroupRows = await db
		.selectDistinct({ groupId: transactions.transactionGroupId })
		.from(transactions)
		.where(
			and(
				eq(transactions.status, "pending"),
				isNull(transactions.deletedAt),
				sql`${transactions.transactionGroupId} IS NOT NULL`,
			),
		)
		.orderBy(transactions.transactionGroupId)
		.limit(pageSize)
		.offset(offset);

	// Count total distinct pending groups
	const [{ total }] = await db
		.select({
			total: sql<number>`COUNT(DISTINCT ${transactions.transactionGroupId})::int`,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.status, "pending"),
				isNull(transactions.deletedAt),
				sql`${transactions.transactionGroupId} IS NOT NULL`,
			),
		);

	if (pendingGroupRows.length === 0) {
		return Response.json({ groups: [], total: 0, page, pageSize });
	}

	const groupIds = pendingGroupRows
		.map((r) => r.groupId)
		.filter(Boolean) as string[];

	// Step 2: Fetch all rows for those group IDs
	const allRows = await db
		.select({
			id: transactions.id,
			transactionGroupId: transactions.transactionGroupId,
			name: transactions.name,
			date: transactions.date,
			amount: transactions.amount,
			type: transactions.type,
			status: transactions.status,
			paidByUserId: transactions.paidByUserId,
			paidByUserName: user.name,
			categoryId: transactions.categoryId,
			categoryLabel: transactionCategories.label,
			createdAt: transactions.createdAt,
		})
		.from(transactions)
		.leftJoin(user, eq(transactions.paidByUserId, user.id))
		.leftJoin(
			transactionCategories,
			eq(transactions.categoryId, transactionCategories.id),
		)
		.where(
			and(
				inArray(transactions.transactionGroupId, groupIds),
				isNull(transactions.deletedAt),
			),
		)
		.orderBy(transactions.transactionGroupId, transactions.type);

	// Step 3: Assemble PendingGroup objects
	const groupMap = new Map<
		string,
		{
			groupId: string;
			name: string;
			date: string;
			totalAmount: string;
			paidByUserName: string | null;
			paidByUserId: string;
			parties: { userId: string; userName: string | null; amount: string }[];
			categoryLabel: string | null;
			createdAt: string;
		}
	>();

	for (const row of allRows) {
		const gid = row.transactionGroupId;
		if (!gid) continue;
		if (!groupMap.has(gid)) {
			groupMap.set(gid, {
				groupId: gid,
				name: row.name,
				date: row.date.toISOString(),
				totalAmount: "0.00",
				paidByUserName: null,
				paidByUserId: row.paidByUserId,
				parties: [],
				categoryLabel: row.categoryLabel ?? null,
				createdAt: row.createdAt.toISOString(),
			});
		}
		const g = groupMap.get(gid);
		if (!g) continue;

		if (row.type === "deposit") {
			// The deposit row represents the full group amount and the payer
			g.totalAmount = row.amount;
			g.name = row.name;
			g.date = row.date.toISOString();
			g.paidByUserId = row.paidByUserId;
			g.paidByUserName = row.paidByUserName ?? null;
			g.categoryLabel = row.categoryLabel ?? null;
			g.createdAt = row.createdAt.toISOString();
		} else {
			// Withdrawal rows = parties
			g.parties.push({
				userId: row.paidByUserId,
				userName: row.paidByUserName ?? null,
				amount: row.amount,
			});
		}
	}

	const groups = Array.from(groupMap.values());

	return Response.json({ groups, total, page, pageSize });
};

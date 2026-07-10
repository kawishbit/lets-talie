import { db } from "@db/database";
import { transactionCategories, transactions, user } from "@db/schema";
import type { APIRoute } from "astro";
import { and, asc, between, desc, eq, isNull, sql } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 25;

export const GET: APIRoute = async ({ locals, url }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const isAdmin = sessionUser.role === "admin";

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

	const sortBy = url.searchParams.get("sortBy") ?? "date";
	const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";

	const filterStatus = url.searchParams.get("status") ?? "";
	const filterType = url.searchParams.get("type") ?? "";
	const filterCategoryId = url.searchParams.get("categoryId") ?? "";
	const filterDateFrom = url.searchParams.get("dateFrom") ?? "";
	const filterDateTo = url.searchParams.get("dateTo") ?? "";

	// Build where conditions
	const conditions = [];

	// Admins see all (including soft-deleted, shown greyed out in the UI);
	// regular users see only their own, and never their deleted rows.
	if (!isAdmin) {
		conditions.push(eq(transactions.paidByUserId, sessionUser.id));
		conditions.push(isNull(transactions.deletedAt));
	}

	if (filterStatus) {
		conditions.push(eq(transactions.status, filterStatus));
	}

	if (filterType) {
		conditions.push(eq(transactions.type, filterType));
	}

	if (filterCategoryId) {
		conditions.push(eq(transactions.categoryId, filterCategoryId));
	}

	if (filterDateFrom && filterDateTo) {
		const from = new Date(filterDateFrom);
		const to = new Date(filterDateTo);
		to.setHours(23, 59, 59, 999);
		if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
			conditions.push(between(transactions.date, from, to));
		}
	} else if (filterDateFrom) {
		const from = new Date(filterDateFrom);
		if (!Number.isNaN(from.getTime())) {
			conditions.push(sql`${transactions.date} >= ${from}`);
		}
	} else if (filterDateTo) {
		const to = new Date(filterDateTo);
		to.setHours(23, 59, 59, 999);
		if (!Number.isNaN(to.getTime())) {
			conditions.push(sql`${transactions.date} <= ${to}`);
		}
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	// Sort
	const sortCol = sortBy === "amount" ? transactions.amount : transactions.date;
	const order = sortDir === "asc" ? asc(sortCol) : desc(sortCol);

	const [items, [{ total }]] = await Promise.all([
		db
			.select({
				id: transactions.id,
				transactionGroupId: transactions.transactionGroupId,
				name: transactions.name,
				date: transactions.date,
				remarks: transactions.remarks,
				amount: transactions.amount,
				type: transactions.type,
				status: transactions.status,
				paidByUserId: transactions.paidByUserId,
				paidByUserName: user.name,
				categoryId: transactions.categoryId,
				categoryLabel: transactionCategories.label,
				createdAt: transactions.createdAt,
				deletedAt: transactions.deletedAt,
			})
			.from(transactions)
			.leftJoin(user, eq(transactions.paidByUserId, user.id))
			.leftJoin(
				transactionCategories,
				eq(transactions.categoryId, transactionCategories.id),
			)
			.where(where)
			.orderBy(order)
			.limit(pageSize)
			.offset(offset),

		db
			.select({ total: sql<number>`COUNT(*)::int` })
			.from(transactions)
			.where(where),
	]);

	return Response.json({ items, total, page, pageSize });
};

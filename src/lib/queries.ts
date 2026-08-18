import { db } from "@db/database";
import { transactionCategories, transactions, user } from "@db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

export type UserOption = { id: string; name: string; email: string };
export type CategoryOption = { id: string; label: string };

export async function fetchUsersAndCategories(): Promise<{
	users: UserOption[];
	categories: CategoryOption[];
}> {
	const [users, categories] = await Promise.all([
		db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(isNull(user.deletedAt))
			.orderBy(asc(user.name)),
		db
			.select({
				id: transactionCategories.id,
				label: transactionCategories.label,
			})
			.from(transactionCategories)
			.where(isNull(transactionCategories.deletedAt))
			.orderBy(asc(transactionCategories.label)),
	]);
	return { users, categories };
}

export interface PendingParty {
	userId: string;
	userName: string | null;
	amount: string;
}

export interface PendingEntry {
	id: string; // transactionGroupId for groups, transaction id for singles
	kind: "group" | "single";
	name: string;
	date: string;
	totalAmount: string;
	type: "deposit" | "withdrawal";
	paidByUserName: string | null;
	paidByUserId: string;
	parties: PendingParty[];
	categoryLabel: string | null;
	createdAt: string;
}

/**
 * Fetches pending approval entries. A multi-party transaction group is keyed
 * by its transactionGroupId, with the deposit row as the representative row
 * and withdrawal rows as parties. A standalone single transaction has no
 * transactionGroupId, so it's keyed by its own id and treated as a group of
 * one — it has no parties, and its own row is the representative row.
 */
export async function fetchPendingEntries(
	page: number,
	pageSize: number,
): Promise<{ entries: PendingEntry[]; total: number }> {
	const rows = await db
		.select({
			id: transactions.id,
			transactionGroupId: transactions.transactionGroupId,
			name: transactions.name,
			date: transactions.date,
			amount: transactions.amount,
			type: transactions.type,
			paidByUserId: transactions.paidByUserId,
			paidByUserName: user.name,
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
			and(eq(transactions.status, "pending"), isNull(transactions.deletedAt)),
		);

	const entryMap = new Map<string, PendingEntry>();

	for (const row of rows) {
		const isGroup = row.transactionGroupId !== null;
		const id = row.transactionGroupId ?? row.id;

		if (!entryMap.has(id)) {
			entryMap.set(id, {
				id,
				kind: isGroup ? "group" : "single",
				name: row.name,
				date: row.date.toISOString(),
				totalAmount: row.amount,
				type: row.type as "deposit" | "withdrawal",
				paidByUserName: row.paidByUserName ?? null,
				paidByUserId: row.paidByUserId,
				parties: [],
				categoryLabel: row.categoryLabel ?? null,
				createdAt: row.createdAt.toISOString(),
			});
		}
		const entry = entryMap.get(id);
		if (!entry) continue;

		// A single transaction's lone row is its own representative row; a
		// group's representative row is its deposit, other rows are parties.
		if (!isGroup || row.type === "deposit") {
			entry.totalAmount = row.amount;
			entry.name = row.name;
			entry.date = row.date.toISOString();
			entry.type = row.type as "deposit" | "withdrawal";
			entry.paidByUserId = row.paidByUserId;
			entry.paidByUserName = row.paidByUserName ?? null;
			entry.categoryLabel = row.categoryLabel ?? null;
			entry.createdAt = row.createdAt.toISOString();
		} else {
			entry.parties.push({
				userId: row.paidByUserId,
				userName: row.paidByUserName ?? null,
				amount: row.amount,
			});
		}
	}

	const entries = [...entryMap.values()].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const total = entries.length;
	const offset = (page - 1) * pageSize;

	return { entries: entries.slice(offset, offset + pageSize), total };
}

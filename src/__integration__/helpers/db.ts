import { db } from "@db/database";
import { transactionCategories, transactions, user } from "@db/schema";
import { sql } from "drizzle-orm";

export { db };

let counter = 0;

/** Deterministic-ish unique id for seeded rows, readable in failure output. */
export function uid(prefix: string): string {
	counter += 1;
	return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Wipes every app + auth table. Runs before each integration test (see
 * src/__integration__/setup.ts) so tests never see state left over from a
 * previous test.
 */
export async function resetDb(): Promise<void> {
	await db.execute(
		sql`TRUNCATE TABLE "transactions", "transaction_categories", "verification", "account", "session", "user" RESTART IDENTITY CASCADE`,
	);
}

type SeedUserOverrides = Partial<{
	id: string;
	name: string;
	email: string;
	role: "user" | "admin";
	accountBalance: string;
	emailVerified: boolean;
	deletedAt: Date | null;
}>;

export async function seedUser(overrides: SeedUserOverrides = {}) {
	const now = new Date();
	const id = overrides.id ?? uid("user");
	const email = overrides.email ?? `${id}@example.test`;
	const role = overrides.role ?? "user";

	await db.insert(user).values({
		id,
		name: overrides.name ?? "Test User",
		email,
		emailVerified: overrides.emailVerified ?? true,
		role,
		accountBalance: overrides.accountBalance ?? "0.00",
		createdAt: now,
		updatedAt: now,
		deletedAt: overrides.deletedAt ?? null,
	});

	return { id, email, role };
}

export async function seedAdmin(overrides: SeedUserOverrides = {}) {
	return seedUser({ role: "admin", ...overrides });
}

type SeedCategoryOverrides = Partial<{
	id: string;
	label: string;
	remarks: string | null;
	deletedAt: Date | null;
}>;

export async function seedCategory(overrides: SeedCategoryOverrides = {}) {
	const now = new Date();
	const id = overrides.id ?? uid("cat");

	await db.insert(transactionCategories).values({
		id,
		label: overrides.label ?? "Test Category",
		remarks: overrides.remarks ?? null,
		createdAt: now,
		updatedAt: now,
		deletedAt: overrides.deletedAt ?? null,
	});

	return { id };
}

type SeedTransactionOverrides = {
	id?: string;
	transactionGroupId?: string | null;
	name?: string;
	date?: Date;
	amount?: string;
	type?: "deposit" | "withdrawal";
	status?: "pending" | "completed" | "cancelled";
	paidByUserId: string;
	createdByUserId?: string;
	categoryId?: string | null;
	deletedAt?: Date | null;
};

export async function seedTransaction(overrides: SeedTransactionOverrides) {
	const now = new Date();
	const id = overrides.id ?? uid("txn");

	await db.insert(transactions).values({
		id,
		transactionGroupId: overrides.transactionGroupId ?? null,
		name: overrides.name ?? "Test Transaction",
		date: overrides.date ?? now,
		remarks: null,
		amount: overrides.amount ?? "10.00",
		type: overrides.type ?? "deposit",
		status: overrides.status ?? "completed",
		paidByUserId: overrides.paidByUserId,
		createdByUserId: overrides.createdByUserId ?? overrides.paidByUserId,
		categoryId: overrides.categoryId ?? null,
		createdAt: now,
		updatedAt: now,
		deletedAt: overrides.deletedAt ?? null,
	});

	return { id, paidByUserId: overrides.paidByUserId };
}

type SeedGroupOptions = {
	paidByUserId: string;
	parties: string[];
	amount: number;
	status?: "pending" | "completed" | "cancelled";
	name?: string;
	categoryId?: string | null;
	customAmounts?: Record<string, number>;
};

/** Inserts a full group transaction (1 deposit + N withdrawals) directly, bypassing the API. */
export async function seedGroup(opts: SeedGroupOptions) {
	const groupId = uid("group");
	const now = new Date();
	const status = opts.status ?? "completed";
	const perPerson = (opts.amount / opts.parties.length).toFixed(2);

	const common = {
		transactionGroupId: groupId,
		name: opts.name ?? "Test Group",
		date: now,
		remarks: null,
		categoryId: opts.categoryId ?? null,
		status,
		createdByUserId: opts.paidByUserId,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
	};

	await db.insert(transactions).values({
		id: uid("txn"),
		...common,
		amount: opts.amount.toFixed(2),
		type: "deposit",
		paidByUserId: opts.paidByUserId,
	});

	for (const partyId of opts.parties) {
		const amount = opts.customAmounts
			? (opts.customAmounts[partyId] ?? 0).toFixed(2)
			: perPerson;
		await db.insert(transactions).values({
			id: uid("txn"),
			...common,
			amount,
			type: "withdrawal",
			paidByUserId: partyId,
		});
	}

	return { groupId };
}

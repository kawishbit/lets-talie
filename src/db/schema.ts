import { defineRelations } from "drizzle-orm";
import {
	boolean,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

// ─── Better Auth core tables ───────────────────────────────────────────────

export const user = pgTable("user", {
	id: uuid("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
	role: text("role").default("user"),
	accountBalance: text("account_balance").default("0.00"),
	banned: boolean("banned").default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	deletedAt: timestamp("deleted_at"),
});

export const session = pgTable(
	"session",
	{
		id: uuid("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		impersonatedBy: uuid("impersonated_by"),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: uuid("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: uuid("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const authRelations = defineRelations(
	{ user, session, account, verification },
	(r) => ({
		user: {
			sessions: r.many.session(),
			accounts: r.many.account(),
		},
		session: {
			user: r.one.user({
				from: r.session.userId,
				to: r.user.id,
			}),
		},
		account: {
			user: r.one.user({
				from: r.account.userId,
				to: r.user.id,
			}),
		},
	}),
);

// ─── App tables ────────────────────────────────────────────────────────────

export const transactionCategories = pgTable("transaction_categories", {
	id: uuid("id").primaryKey(),
	label: text("label").notNull(),
	remarks: text("remarks"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	deletedAt: timestamp("deleted_at"),
});

export const transactions = pgTable("transactions", {
	id: uuid("id").primaryKey(),
	transactionGroupId: uuid("transaction_group_id"),
	name: text("name").notNull(),
	date: timestamp("date").notNull(),
	remarks: text("remarks"),
	amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
	type: text("type").notNull(), // 'deposit' | 'withdrawal'
	status: text("status").notNull().default("pending"), // 'pending' | 'completed' | 'cancelled'
	createdByUserId: uuid("created_by_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	lastUpdatedByUserId: uuid("last_updated_by_user_id").references(
		() => user.id,
		{ onDelete: "cascade" },
	),
	paidByUserId: uuid("paid_by_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	categoryId: uuid("category_id").references(() => transactionCategories.id, {
		onDelete: "set null",
	}),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	deletedAt: timestamp("deleted_at"),
});

export const transactionRelations = defineRelations(
	{ user, transactionCategories, transactions },
	(r) => ({
		user: {
			createdTransactions: r.many.transactions({
				from: r.user.id,
				to: r.transactions.createdByUserId,
			}),
			lastUpdatedTransactions: r.many.transactions({
				from: r.user.id,
				to: r.transactions.lastUpdatedByUserId,
			}),
			paidTransactions: r.many.transactions({
				from: r.user.id,
				to: r.transactions.paidByUserId,
			}),
		},
		transactionCategories: {
			transactions: r.many.transactions({
				from: r.transactionCategories.id,
				to: r.transactions.categoryId,
			}),
		},
		transactions: {
			createdByUser: r.one.user({
				from: r.transactions.createdByUserId,
				to: r.user.id,
			}),
			lastUpdatedByUser: r.one.user({
				from: r.transactions.lastUpdatedByUserId,
				to: r.user.id,
			}),
			paidByUser: r.one.user({
				from: r.transactions.paidByUserId,
				to: r.user.id,
			}),
			category: r.one.transactionCategories({
				from: r.transactions.categoryId,
				to: r.transactionCategories.id,
			}),
		},
	}),
);

import { db } from "@db/database";
import { transactionCategories, transactions, user } from "@db/schema";
import { recalculateBalances } from "@lib/balance";

// Every row below uses a fixed, deterministic id and is inserted with
// onConflictDoNothing, so re-running this script (e.g. after a redeploy)
// never duplicates data — it's a no-op once the demo data already exists.

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL;
if (!DEMO_USER_EMAIL) {
	console.error("DEMO_USER_EMAIL is required to seed demo data.");
	process.exit(1);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const USERS = [
	{
		id: "demo-user-you",
		name: "You (Demo)",
		email: DEMO_USER_EMAIL,
		role: "admin",
	},
	{
		id: "demo-user-alex",
		name: "Alex Chen",
		email: "alex@demo.lets-talie.app",
		role: "user",
	},
	{
		id: "demo-user-sam",
		name: "Sam Rivera",
		email: "sam@demo.lets-talie.app",
		role: "user",
	},
	{
		id: "demo-user-jordan",
		name: "Jordan Lee",
		email: "jordan@demo.lets-talie.app",
		role: "user",
	},
	{
		id: "demo-user-taylor",
		name: "Taylor Kim",
		email: "taylor@demo.lets-talie.app",
		role: "user",
	},
	{
		id: "demo-user-morgan",
		name: "Morgan Patel",
		email: "morgan@demo.lets-talie.app",
		role: "user",
	},
] as const;

const CATEGORIES = [
	{
		id: "demo-cat-food",
		label: "Food & Drinks",
		remarks: "Restaurants, bars, takeout",
	},
	{
		id: "demo-cat-transport",
		label: "Transport",
		remarks: "Rideshares, gas, transit",
	},
	{
		id: "demo-cat-rent",
		label: "Rent & Utilities",
		remarks: "Shared housing costs",
	},
	{
		id: "demo-cat-entertainment",
		label: "Entertainment",
		remarks: "Movies, events, streaming",
	},
	{ id: "demo-cat-groceries", label: "Groceries", remarks: null },
] as const;

type GroupSeed = {
	id: string;
	name: string;
	daysAgo: number;
	amount: number;
	paidBy: string;
	parties: string[];
	categoryId: string;
	status: "completed" | "pending";
};

const GROUPS: GroupSeed[] = [
	{
		id: "demo-group-dinner",
		name: "Dinner at Nobu",
		daysAgo: 12,
		amount: 120,
		paidBy: "demo-user-you",
		parties: ["demo-user-you", "demo-user-alex", "demo-user-sam"],
		categoryId: "demo-cat-food",
		status: "completed",
	},
	{
		id: "demo-group-uber",
		name: "Uber to airport",
		daysAgo: 9,
		amount: 45,
		paidBy: "demo-user-alex",
		parties: ["demo-user-you", "demo-user-alex", "demo-user-jordan"],
		categoryId: "demo-cat-transport",
		status: "completed",
	},
	{
		id: "demo-group-rent",
		name: "Monthly rent",
		daysAgo: 20,
		amount: 2400,
		paidBy: "demo-user-you",
		parties: [
			"demo-user-you",
			"demo-user-sam",
			"demo-user-taylor",
			"demo-user-morgan",
		],
		categoryId: "demo-cat-rent",
		status: "completed",
	},
	{
		id: "demo-group-groceries",
		name: "Groceries run",
		daysAgo: 3,
		amount: 85.5,
		paidBy: "demo-user-sam",
		parties: ["demo-user-you", "demo-user-sam"],
		categoryId: "demo-cat-groceries",
		status: "completed",
	},
	{
		id: "demo-group-movie",
		name: "Movie night",
		daysAgo: 1,
		amount: 60,
		paidBy: "demo-user-jordan",
		parties: ["demo-user-you", "demo-user-jordan", "demo-user-taylor"],
		categoryId: "demo-cat-entertainment",
		status: "pending",
	},
];

const SINGLES = [
	{
		id: "demo-single-topup",
		name: "Cash top-up",
		daysAgo: 15,
		amount: 100,
		paidBy: "demo-user-you",
		type: "deposit" as const,
		status: "completed" as const,
		categoryId: null,
	},
	{
		id: "demo-single-coffee",
		name: "Coffee run",
		daysAgo: 2,
		amount: 12.75,
		paidBy: "demo-user-you",
		type: "withdrawal" as const,
		status: "completed" as const,
		categoryId: "demo-cat-food",
	},
];

async function seedDemo() {
	console.log("Seeding demo data...");
	const now = new Date();

	await db
		.insert(user)
		.values(
			USERS.map((u) => ({
				id: u.id,
				name: u.name,
				email: u.email,
				emailVerified: true,
				role: u.role,
				accountBalance: "0.00",
				banned: false,
				createdAt: now,
				updatedAt: now,
			})),
		)
		.onConflictDoNothing();

	await db
		.insert(transactionCategories)
		.values(
			CATEGORIES.map((c) => ({
				id: c.id,
				label: c.label,
				remarks: c.remarks,
				createdAt: now,
				updatedAt: now,
			})),
		)
		.onConflictDoNothing();

	for (const group of GROUPS) {
		const perPerson = (group.amount / group.parties.length).toFixed(2);
		const date = daysAgo(group.daysAgo);
		const commonFields = {
			transactionGroupId: group.id,
			name: group.name,
			date,
			remarks: null,
			categoryId: group.categoryId,
			status: group.status,
			createdByUserId: group.paidBy,
			createdAt: now,
			updatedAt: now,
		};

		await db
			.insert(transactions)
			.values({
				id: `${group.id}-deposit`,
				...commonFields,
				amount: group.amount.toFixed(2),
				type: "deposit",
				paidByUserId: group.paidBy,
			})
			.onConflictDoNothing();

		for (const partyId of group.parties) {
			await db
				.insert(transactions)
				.values({
					id: `${group.id}-w-${partyId}`,
					...commonFields,
					amount: perPerson,
					type: "withdrawal",
					paidByUserId: partyId,
				})
				.onConflictDoNothing();
		}
	}

	for (const single of SINGLES) {
		await db
			.insert(transactions)
			.values({
				id: single.id,
				transactionGroupId: null,
				name: single.name,
				date: daysAgo(single.daysAgo),
				remarks: null,
				amount: single.amount.toFixed(2),
				type: single.type,
				status: single.status,
				paidByUserId: single.paidBy,
				categoryId: single.categoryId,
				createdByUserId: single.paidBy,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}

	await recalculateBalances(USERS.map((u) => u.id));

	console.log(
		`Demo data seeded. Sign in as ${DEMO_USER_EMAIL} via "Continue as Demo".`,
	);
	process.exit(0);
}

seedDemo().catch((err) => {
	console.error("Demo seed failed:", err);
	process.exit(1);
});

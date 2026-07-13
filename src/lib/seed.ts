import { db } from "@db/database";
import { account, user } from "@db/schema";
import { eq } from "drizzle-orm";

// This seeds the initial admin user. All other users must be created by an
// admin via authClient.admin.createUser() after this admin logs in.
const ADMIN = {
	name: "Kawish",
	email: "demo@lets-talie-demo.kawishbit.com",
	accountBalance: "0.00",
};

async function seed() {
	console.log("Seeding admin user...");

	const now = new Date();

	await db
		.insert(user)
		.values({
			id: crypto.randomUUID(),
			name: ADMIN.name,
			email: ADMIN.email,
			emailVerified: true,
			role: "admin",
			accountBalance: ADMIN.accountBalance,
			banned: false,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing({ target: user.email });

	// Resolve the actual user ID (may differ if the row already existed).
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, ADMIN.email));

	if (!existing) {
		throw new Error(`User not found after insert: ${ADMIN.email}`);
	}

	// Magic-link account row — Better Auth creates this on first sign-in.
	// We insert it here so the account is pre-registered.
	await db
		.insert(account)
		.values({
			id: crypto.randomUUID(),
			accountId: ADMIN.email,
			providerId: "magic-link",
			userId: existing.id,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();

	console.log(`Admin created: ${ADMIN.email}`);
	console.log("Done. Use authClient.admin.createUser() to add more users.");
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});

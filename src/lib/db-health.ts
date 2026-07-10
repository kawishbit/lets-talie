import { db } from "@db/database";
import { sql } from "drizzle-orm";
import { describeDbError } from "./db-errors";

const CHECK_INTERVAL_MS = 5000;

let cachedError: string | null = null;
let lastCheckedAt = 0;

/**
 * Pings the database and returns a clear, actionable message if it's
 * unreachable or not migrated — null if it's healthy. Cached briefly so we
 * don't ping on every request during normal operation.
 */
export async function checkDbHealth(): Promise<string | null> {
	const now = Date.now();
	if (now - lastCheckedAt < CHECK_INTERVAL_MS) {
		return cachedError;
	}
	lastCheckedAt = now;

	try {
		// Querying the "user" table (owned by Better Auth) doubles as a check
		// that migrations have actually been applied, not just that Postgres
		// is reachable.
		await db.execute(sql`select 1 from "user" limit 1`);
		cachedError = null;
	} catch (err) {
		cachedError =
			describeDbError(err) ??
			"Unexpected database error. Check the server logs for details.";
	}

	return cachedError;
}

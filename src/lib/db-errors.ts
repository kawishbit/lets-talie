/**
 * Classifies errors surfaced from Postgres/postgres-js so the app can show a
 * clear, actionable message instead of a bare "Failed to get session".
 *
 * Drizzle and Better Auth both wrap the underlying driver error (as `.cause`),
 * so the real `.code` may be a few layers deep — walk the chain to find it.
 */
export function describeDbError(err: unknown): string | null {
	let current: unknown = err;
	for (let depth = 0; depth < 5 && current; depth++) {
		const code = (current as { code?: string }).code;

		if (
			code === "ECONNREFUSED" ||
			code === "ENOTFOUND" ||
			code === "ETIMEDOUT" ||
			code === "CONNECTION_CLOSED" ||
			code === "CONNECTION_ENDED" ||
			code === "CONNECT_TIMEOUT"
		) {
			return (
				"Could not connect to the database. Make sure Postgres is running " +
				"and DATABASE_URL in your .env is correct."
			);
		}

		// Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
		if (code === "42P01") {
			// undefined_table
			return "Database schema is not migrated (missing tables). Run `bun run migrate`.";
		}

		if (code === "3D000") {
			// invalid_catalog_name
			return "The database in DATABASE_URL does not exist. Create it, then run `bun run migrate`.";
		}

		current = (current as { cause?: unknown }).cause;
	}

	return null;
}

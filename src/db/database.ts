import { drizzle } from "drizzle-orm/bun-sql";

if (!Bun.env.DATABASE_URL) {
	throw new Error(
		"DATABASE_URL is not set. Copy .env.example to .env and set DATABASE_URL " +
			"(e.g. postgres://user:password@localhost:5432/dbname), then restart the server.",
	);
}

export const db = drizzle(Bun.env.DATABASE_URL);

/**
 * The test orchestrators and Vitest run under Node, which — unlike Bun — does
 * not automatically load `.env`. Load it explicitly here and import this first,
 * anywhere `process.env.TEST_DATABASE_URL` / `BETTER_AUTH_SECRET` / etc. are
 * read outside of a Vitest worker (which does inherit `test.env`).
 */
try {
	process.loadEnvFile();
} catch {
	// No .env file — fine when the values are already in the environment
	// (e.g. CI setting them directly).
}

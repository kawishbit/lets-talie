/**
 * `bun run test:integration` invokes the `vitest` binary, which has a
 * `#!/usr/bin/env node` shebang — so vitest's own process (and therefore its
 * config file evaluation and `globalSetup`) runs under plain Node, not Bun,
 * and never gets Bun's automatic `.env` loading. Import this first, anywhere
 * `process.env.TEST_DATABASE_URL` / `BETTER_AUTH_SECRET` / etc. are read
 * outside of a Vitest worker (which does inherit `test.env`).
 */
try {
	process.loadEnvFile();
} catch {
	// No .env file — fine when the values are already in the environment
	// (e.g. CI setting them directly).
}

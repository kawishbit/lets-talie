import "./src/__integration__/helpers/env";
import { defineConfig, devices } from "@playwright/test";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error(
		"DATABASE_URL is not set. Run via `bun run test:e2e` " +
			"(src/__integration__/e2e/run-e2e.ts), which provisions a test " +
			"Postgres + Mailpit via testcontainers and sets this before invoking playwright.",
	);
}
if (!process.env.BETTER_AUTH_SECRET) {
	throw new Error(
		"BETTER_AUTH_SECRET must be set (see .env) — the test session-cookie " +
			"helper signs cookies with the same secret the server verifies against.",
	);
}

// Test files (via fixtures.ts -> helpers/db.ts) import the app's own `db`
// singleton directly to seed/reset data — point it at the test DB for this
// whole run, same reasoning as vitest.integration.config.ts's `test.env`.
process.env.DATABASE_URL = DATABASE_URL;

const PORT = process.env.TEST_E2E_PORT ?? "30098";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./src/__integration__/e2e",
	// Shared DB + one server: parallel workers would race resetDb() against
	// each other.
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 30_000,
	reporter: "list",
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	// Deliberately builds + runs the standalone Node server rather than
	// `astro dev` — see the equivalent note in
	// src/__integration__/run-integration.ts for why (Astro 7's per-project
	// background-dev-server singleton would conflict with a real dev server
	// the user has running).
	webServer: {
		command: "bun run build && node ./dist/server/entry.mjs",
		url: BASE_URL,
		reuseExistingServer: false,
		timeout: 60_000,
		env: {
			DATABASE_URL,
			PORT,
			HOST: "localhost",
			BETTER_AUTH_URL: BASE_URL,
			BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
			SMTP_HOST: process.env.SMTP_HOST ?? "127.0.0.1",
			SMTP_PORT: process.env.SMTP_PORT ?? "1026",
			SMTP_SECURE: "false",
			SMTP_FROM: "noreply@lets-talie.test",
			PUBLIC_DEMO_MODE: "false",
		},
	},
});

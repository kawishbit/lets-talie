import "./src/__integration__/helpers/env";
import { defineConfig, devices } from "@playwright/test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
	throw new Error(
		"TEST_DATABASE_URL is not set. Start the test DB with " +
			"`docker compose --profile test up -d db-test mailpit-test` and set " +
			"TEST_DATABASE_URL in .env before running E2E tests.",
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
process.env.DATABASE_URL = TEST_DATABASE_URL;

const PORT = process.env.TEST_E2E_PORT ?? "30098";
const BASE_URL = `http://localhost:${PORT}`;
const MAILPIT_SMTP_PORT = process.env.MAILPIT_TEST_SMTP_PORT ?? "1026";

export default defineConfig({
	testDir: "./src/__integration__/e2e",
	// Shared DB + one server: parallel workers would race resetDb() against
	// each other.
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 30_000,
	reporter: "list",
	// Runs once, before the webServer / any test: applies migrations to the
	// test DB (see globalSetup.ts). The webServer's own build+start below
	// then runs against an already-migrated database.
	globalSetup: "./src/__integration__/e2e/globalSetup.ts",
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	// Deliberately builds + runs the standalone Node server rather than
	// `astro dev` — see the equivalent note in
	// src/__integration__/globalSetup.ts for why (Astro 7's per-project
	// background-dev-server singleton would conflict with a real dev server
	// the user has running).
	webServer: {
		command: "bun run build && bun ./dist/server/entry.mjs",
		url: BASE_URL,
		reuseExistingServer: false,
		timeout: 60_000,
		env: {
			DATABASE_URL: TEST_DATABASE_URL,
			PORT,
			HOST: "localhost",
			BETTER_AUTH_URL: BASE_URL,
			BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
			SMTP_HOST: "127.0.0.1",
			SMTP_PORT: MAILPIT_SMTP_PORT,
			SMTP_SECURE: "false",
			SMTP_FROM: "noreply@lets-talie.test",
			PUBLIC_DEMO_MODE: "false",
		},
	},
});

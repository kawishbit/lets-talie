/// <reference types="vitest/config" />
import "./src/__integration__/helpers/env";
import { getViteConfig } from "astro/config";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
	throw new Error(
		"TEST_DATABASE_URL is not set. Start the test DB with " +
			"`docker compose --profile test up -d db-test mailpit-test` and set " +
			"TEST_DATABASE_URL in .env before running integration tests.",
	);
}

export default getViteConfig({
	test: {
		environment: "node",
		globals: true,
		// Points the app's own `db` singleton (src/db/database.ts reads
		// Bun.env.DATABASE_URL at import time) at the dedicated test database
		// for every file in this run — both for direct-DB assertions here and
		// for the business-logic calls Phase 8's mocked tests can't exercise.
		env: {
			DATABASE_URL: TEST_DATABASE_URL,
		},
		setupFiles: ["./src/__integration__/setup.ts"],
		// Runs once for the whole suite: applies migrations, then spawns a
		// live Astro dev server against the test DB (see globalSetup.ts).
		globalSetup: ["./src/__integration__/globalSetup.ts"],
		include: ["src/__integration__/api/**/*.test.ts"],
		testTimeout: 20_000,
		hookTimeout: 45_000,
		// All files share one live server + one DB; resetDb() between tests
		// would race against concurrent files.
		fileParallelism: false,
	},
});

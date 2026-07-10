/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error(
		"DATABASE_URL is not set. Run via `bun run test:integration` " +
			"(src/__integration__/run-integration.ts), which provisions a test " +
			"Postgres via testcontainers and sets this before invoking vitest.",
	);
}

export default getViteConfig({
	test: {
		environment: "node",
		globals: true,
		// Points the app's own `db` singleton (src/db/database.ts reads
		// process.env.DATABASE_URL at import time) at the dedicated test database
		// for every file in this run — both for direct-DB assertions here and
		// for the business-logic calls Phase 8's mocked tests can't exercise.
		env: {
			DATABASE_URL,
		},
		setupFiles: ["./src/__integration__/setup.ts"],
		include: ["src/__integration__/api/**/*.test.ts"],
		testTimeout: 20_000,
		hookTimeout: 45_000,
		// All files share one live server + one DB; resetDb() between tests
		// would race against concurrent files.
		fileParallelism: false,
	},
});

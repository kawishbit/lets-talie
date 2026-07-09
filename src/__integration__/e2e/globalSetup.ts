/**
 * Playwright `globalSetup`: runs once before the webServer starts and before
 * any test. Only applies migrations here — the webServer in
 * playwright.config.ts handles building + starting the actual server.
 */
import { spawn } from "node:child_process";
import "../helpers/env";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export default async function globalSetup() {
	if (!TEST_DATABASE_URL) {
		throw new Error("TEST_DATABASE_URL is not set — see playwright.config.ts");
	}

	console.log("[e2e] applying migrations to test database...");
	const exitCode = await new Promise<number>((resolve, reject) => {
		const child = spawn("bunx", ["--bun", "drizzle-kit", "migrate"], {
			cwd: process.cwd(),
			env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("exit", (code) => resolve(code ?? 1));
	});
	if (exitCode !== 0) {
		throw new Error(`drizzle-kit migrate exited with code ${exitCode}`);
	}
}

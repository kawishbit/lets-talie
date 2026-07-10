/**
 * Orchestrator for `test:e2e` (run via `tsx`) — replaces invoking `playwright test`
 * directly. Provisions the test Postgres + Mailpit via testcontainers and
 * applies migrations, THEN spawns `playwright test` as a child (inheriting
 * `DATABASE_URL` / `SMTP_HOST` / `SMTP_PORT` / `MAILPIT_TEST_HTTP_PORT` via
 * normal process env inheritance — playwright.config.ts's `webServer` and
 * the test worker processes both pick these up from there), and tears
 * everything down afterwards.
 *
 * Same reasoning as run-integration.ts for why this can't happen inside
 * Playwright's own `globalSetup`: calling `provisionContainers()` from
 * *inside* a test-runner-owned process (proven for Vitest; Playwright is
 * the same category of process — a test runner spawning/managing its own
 * child processes) is where the hang was reproduced, while the identical
 * call from a plain top-level Node script always resolves in ~1-2s.
 * Running provisioning as the true top-level process, with the test runner
 * spawned as its child, sidesteps that.
 */
import { spawn } from "node:child_process";
import "../helpers/env";
import { provisionContainers } from "../helpers/containers";

function run(
	cmd: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: process.cwd(),
			env,
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("exit", (code) => resolve(code ?? 1));
	});
}

async function main() {
	console.log("[e2e] provisioning test containers (Postgres + Mailpit)...");
	const containers = await provisionContainers();
	console.log(
		`[e2e] containers ready: postgres=${containers.postgresUri} mailpit-http=${containers.mailpitHttpPort}`,
	);

	try {
		console.log("[e2e] applying migrations to test database...");
		const migrateExitCode = await run("bunx", ["drizzle-kit", "migrate"], {
			...process.env,
			DATABASE_URL: containers.postgresUri,
		});
		if (migrateExitCode !== 0) {
			throw new Error(
				`drizzle-kit migrate exited with code ${migrateExitCode}`,
			);
		}

		console.log("[e2e] running playwright...");
		const playwrightExitCode = await run("bunx", ["playwright", "test"], {
			...process.env,
			DATABASE_URL: containers.postgresUri,
			SMTP_HOST: containers.mailpitHost,
			SMTP_PORT: String(containers.mailpitSmtpPort),
			MAILPIT_TEST_HTTP_PORT: String(containers.mailpitHttpPort),
		});
		process.exitCode = playwrightExitCode;
	} finally {
		console.log("[e2e] stopping test containers...");
		await containers.dispose();
	}
}

main().catch((err) => {
	console.error("[e2e] failed:", err);
	process.exitCode = 1;
});

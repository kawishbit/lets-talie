/**
 * Orchestrator for `bun run test:integration` — replaces invoking `vitest`
 * directly. Provisions the test Postgres + Mailpit via testcontainers,
 * applies migrations, builds + starts the app, THEN spawns `vitest run` as
 * a child (inheriting `DATABASE_URL` / `MAILPIT_TEST_HTTP_PORT` via normal
 * process env inheritance), and tears everything down afterwards.
 *
 * This exists because calling `provisionContainers()` from *inside* Vitest's
 * own `globalSetup` reliably hangs in this project: the exact same
 * testcontainers call that resolves in ~1-2s when run as a plain top-level
 * `bun`/`node` script never resolves when Vitest is anywhere in the process
 * tree — reproduced identically with both the project's real (Astro-wrapped)
 * vitest config and a bare `defineConfig` from "vitest/config" with no Astro
 * involved, which rules out Astro's `getViteConfig` and implicates Vitest
 * itself. Running container provisioning as the true top-level process
 * (with Vitest spawned as ITS child, never the reverse) sidesteps whatever
 * that interference is.
 *
 * Same reasoning as the old globalSetup.ts for NOT using `astro dev`: Astro
 * 7 tracks a single background dev-server daemon per project root, which
 * would conflict with a real dev server the user has running — so this
 * builds the app and runs the standalone Node output directly instead.
 */
import { spawn } from "node:child_process";
import "./helpers/env";
import { provisionContainers } from "./helpers/containers";

const TEST_APP_PORT = process.env.TEST_APP_PORT ?? "30099";
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const BASE_URL = `http://localhost:${TEST_APP_PORT}`;

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

async function waitForServer(deadlineMs: number): Promise<boolean> {
	const deadline = Date.now() + deadlineMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${BASE_URL}/login`);
			if (res.status === 200) return true;
		} catch {
			// server not accepting connections yet
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	return false;
}

async function main() {
	if (!BETTER_AUTH_SECRET) {
		throw new Error(
			"BETTER_AUTH_SECRET must be set (see .env) — the test session-cookie " +
				"helper signs cookies with the same secret the server verifies against.",
		);
	}

	console.log(
		"[integration] provisioning test containers (Postgres + Mailpit)...",
	);
	const containers = await provisionContainers();
	console.log(
		`[integration] containers ready: postgres=${containers.postgresUri} mailpit-http=${containers.mailpitHttpPort}`,
	);

	try {
		console.log("[integration] applying migrations to test database...");
		const migrateExitCode = await run(
			"bunx",
			["--bun", "drizzle-kit", "migrate"],
			{ ...process.env, DATABASE_URL: containers.postgresUri },
		);
		if (migrateExitCode !== 0) {
			throw new Error(
				`drizzle-kit migrate exited with code ${migrateExitCode}`,
			);
		}

		console.log("[integration] building app...");
		const buildExitCode = await run("bunx", ["--bun", "astro", "build"], {
			...process.env,
			DATABASE_URL: containers.postgresUri,
			PUBLIC_DEMO_MODE: "false",
		});
		if (buildExitCode !== 0) {
			throw new Error(`astro build exited with code ${buildExitCode}`);
		}

		console.log(`[integration] starting test server on ${BASE_URL}...`);
		const server = spawn("bun", ["./dist/server/entry.mjs"], {
			cwd: process.cwd(),
			env: {
				...process.env,
				PORT: TEST_APP_PORT,
				HOST: "localhost",
				DATABASE_URL: containers.postgresUri,
				BETTER_AUTH_URL: BASE_URL,
				BETTER_AUTH_SECRET,
				SMTP_HOST: containers.mailpitHost,
				SMTP_PORT: String(containers.mailpitSmtpPort),
				SMTP_SECURE: "false",
				SMTP_USER: "",
				SMTP_PASS: "",
				SMTP_FROM: "noreply@lets-talie.test",
				PUBLIC_DEMO_MODE: "false",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		let log = "";
		server.stdout.on("data", (chunk) => {
			log += chunk.toString();
			if (log.length > 20_000) log = log.slice(-20_000);
		});
		server.stderr.on("data", (chunk) => {
			log += chunk.toString();
			if (log.length > 20_000) log = log.slice(-20_000);
		});

		try {
			const ready = await waitForServer(20_000);
			if (!ready) {
				throw new Error(
					`Test server did not become ready on ${BASE_URL} within 20s.\n${log}`,
				);
			}
			console.log(`[integration] test server ready at ${BASE_URL}`);

			console.log("[integration] running vitest...");
			const vitestExitCode = await run(
				"bunx",
				["--bun", "vitest", "run", "--config", "vitest.integration.config.ts"],
				{
					...process.env,
					DATABASE_URL: containers.postgresUri,
					MAILPIT_TEST_HTTP_PORT: String(containers.mailpitHttpPort),
				},
			);
			process.exitCode = vitestExitCode;
		} finally {
			server.kill();
			await new Promise((resolve) => server.on("exit", resolve));
		}
	} finally {
		console.log("[integration] stopping test containers...");
		await containers.dispose();
	}
}

main().catch((err) => {
	console.error("[integration] failed:", err);
	process.exitCode = 1;
});

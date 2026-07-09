/**
 * Vitest `globalSetup`: runs once for the whole integration run (not per
 * file/worker). Applies migrations to the test DB, builds the app, then
 * runs the standalone Node server output directly.
 *
 * Deliberately NOT `astro dev`: Astro 7 tracks a single background dev-server
 * daemon per project root (see node_modules/astro/dist/cli/dev/*.js) — when
 * running under an agent-detected environment it forces background+lockfile
 * mode on every invocation regardless of --port, so a second `astro dev`
 * for the test DB would either refuse to start or silently reuse/replace
 * whatever dev server the user already has running on their real port. The
 * built standalone server (`bun run build` + `bun dist/server/entry.mjs`,
 * same as the `start` script) has no such singleton, so it runs fully
 * isolated on its own port.
 *
 * Runs under plain Node (vitest's own `#!/usr/bin/env node` shebang, not
 * Bun) — so this uses node:child_process, not Bun.spawn, even though the
 * spawned commands (`bunx ...` / `bun ...`) launch Bun processes for the
 * app itself.
 */
import { spawn } from "node:child_process";
import "./helpers/env";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const TEST_APP_PORT = process.env.TEST_APP_PORT ?? "30099";
const MAILPIT_SMTP_PORT = process.env.MAILPIT_TEST_SMTP_PORT ?? "1026";
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

export default async function globalSetup() {
	if (!TEST_DATABASE_URL) {
		throw new Error(
			"TEST_DATABASE_URL is not set. Start the test DB with " +
				"`docker compose --profile test up -d db-test mailpit-test` and set " +
				"TEST_DATABASE_URL in .env before running integration tests.",
		);
	}
	if (!BETTER_AUTH_SECRET) {
		throw new Error(
			"BETTER_AUTH_SECRET must be set (see .env) — the test session-cookie " +
				"helper signs cookies with the same secret the server verifies against.",
		);
	}

	console.log("[integration] applying migrations to test database...");
	const migrateExitCode = await run(
		"bunx",
		["--bun", "drizzle-kit", "migrate"],
		{ ...process.env, DATABASE_URL: TEST_DATABASE_URL },
	);
	if (migrateExitCode !== 0) {
		throw new Error(`drizzle-kit migrate exited with code ${migrateExitCode}`);
	}

	console.log("[integration] building app...");
	const buildExitCode = await run("bunx", ["--bun", "astro", "build"], {
		...process.env,
		DATABASE_URL: TEST_DATABASE_URL,
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
			DATABASE_URL: TEST_DATABASE_URL,
			BETTER_AUTH_URL: BASE_URL,
			BETTER_AUTH_SECRET,
			SMTP_HOST: "127.0.0.1",
			SMTP_PORT: MAILPIT_SMTP_PORT,
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

	const ready = await waitForServer(20_000);
	if (!ready) {
		server.kill();
		throw new Error(
			`Test server did not become ready on ${BASE_URL} within 20s.\n${log}`,
		);
	}

	console.log(`[integration] test server ready at ${BASE_URL}`);

	return async () => {
		server.kill();
		await new Promise((resolve) => server.on("exit", resolve));
	};
}

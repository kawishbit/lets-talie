/**
 * testcontainers-node's Docker interaction hangs indefinitely under the Bun
 * runtime in this project (confirmed via a spike: identical container-start
 * code returns in seconds under plain Node, never resolves under
 * `bunx --bun`) — so this file is the *only* place `testcontainers` /
 * `@testcontainers/postgresql` are imported, and it is always invoked as a
 * standalone plain-`node` child process (see `../helpers/containers.ts`),
 * never imported directly into Bun-run code.
 *
 * Protocol with the parent process:
 *  - stdout: emits exactly one `READY <json>` line once both containers are
 *    up, where json is `{ postgresUri, mailpitHost, mailpitSmtpPort, mailpitHttpPort }`.
 *  - stdin: a `STOP` line (or SIGTERM/SIGINT) triggers stopping both
 *    containers, after which this process exits.
 */

import { createInterface } from "node:readline";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Wait } from "testcontainers";

const DB_NAME = "letstalie_test";
const DB_USER = "letstalie_test";
const DB_PASSWORD = "letstalie_test";

function log(msg) {
	console.error(`[containers-runner] ${new Date().toISOString()} ${msg}`);
}

/**
 * testcontainers' own internal startup timeout doesn't reliably fire here —
 * observed hangs where the underlying container is already healthy (per
 * `docker logs`) but the JS `.start()` promise never resolves, presumably a
 * stuck dockerode log-follow socket read (a known class of flakiness against
 * Docker Desktop's VM on macOS). Race against an external timeout and retry
 * with a fresh container instead of trusting the library to give up on its own.
 */
async function startWithRetry(
	factory,
	label,
	{ timeoutMs = 30_000, retries = 2 } = {},
) {
	for (let attempt = 1; attempt <= retries + 1; attempt++) {
		log(`starting ${label} (attempt ${attempt}/${retries + 1})...`);
		let timer;
		const timeout = new Promise((_, reject) => {
			timer = setTimeout(
				() =>
					reject(new Error(`${label} start timed out after ${timeoutMs}ms`)),
				timeoutMs,
			);
		});
		try {
			const container = await Promise.race([factory(), timeout]);
			clearTimeout(timer);
			log(`${label} started`);
			return container;
		} catch (err) {
			clearTimeout(timer);
			log(`${label} attempt ${attempt} failed: ${err.message}`);
			if (attempt > retries) throw err;
		}
	}
	throw new Error(`unreachable: ${label} retry loop exhausted`);
}

async function main() {
	const pg = await startWithRetry(
		() =>
			new PostgreSqlContainer("postgres:16-alpine")
				.withDatabase(DB_NAME)
				.withUsername(DB_USER)
				.withPassword(DB_PASSWORD)
				.start(),
		"postgres",
	);

	const mailpit = await startWithRetry(
		() =>
			new GenericContainer("axllent/mailpit:latest")
				.withExposedPorts(1025, 8025)
				.withWaitStrategy(Wait.forListeningPorts())
				.start(),
		"mailpit",
	);

	const info = {
		postgresUri: pg.getConnectionUri(),
		mailpitHost: mailpit.getHost(),
		mailpitSmtpPort: mailpit.getMappedPort(1025),
		mailpitHttpPort: mailpit.getMappedPort(8025),
	};

	process.stdout.write(`READY ${JSON.stringify(info)}\n`);

	let shuttingDown = false;
	async function shutdown() {
		if (shuttingDown) return;
		shuttingDown = true;
		try {
			await mailpit.stop();
			await pg.stop();
		} finally {
			process.exit(0);
		}
	}

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	const rl = createInterface({ input: process.stdin });
	rl.on("line", (line) => {
		if (line.trim() === "STOP") {
			rl.close();
			shutdown();
		}
	});
}

main().catch((err) => {
	console.error("[containers-runner] failed to start containers:", err);
	process.exit(1);
});

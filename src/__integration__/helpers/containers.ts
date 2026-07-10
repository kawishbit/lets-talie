/**
 * Provisions a throwaway Postgres + Mailpit via testcontainers-node for the
 * integration/E2E test run. All actual `testcontainers` calls happen in
 * `./containers-runner.mjs`, spawned here as a `node` child process — see
 * that file's header comment for why. This module only talks to that child
 * over stdio and never imports `testcontainers` directly.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const RUNNER_PATH = fileURLToPath(
	new URL("./containers-runner.mjs", import.meta.url),
);

export interface ContainerInfo {
	postgresUri: string;
	mailpitHost: string;
	mailpitSmtpPort: number;
	mailpitHttpPort: number;
}

export interface ProvisionedContainers extends ContainerInfo {
	/** Stops both containers and the runner process. Safe to await once. */
	dispose: () => Promise<void>;
}

export async function provisionContainers(
	// containers-runner.mjs retries each container start up to 3x with its own
	// 30s-per-attempt timeout (worst case ~90s per container), so this outer
	// budget needs enough room for both postgres and mailpit to each exhaust
	// their retries.
	timeoutMs = 210_000,
): Promise<ProvisionedContainers> {
	const child = spawn("node", [RUNNER_PATH], {
		stdio: ["pipe", "pipe", "pipe"],
	});

	let stderrLog = "";
	child.stderr.on("data", (chunk: Buffer) => {
		stderrLog += chunk.toString();
		process.stderr.write(chunk);
	});

	const rl = createInterface({ input: child.stdout });

	const info = await new Promise<ContainerInfo>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(
				new Error(
					`Timed out after ${timeoutMs}ms waiting for containers-runner to report READY.\n${stderrLog}`,
				),
			);
		}, timeoutMs);

		child.once("exit", (code) => {
			if (code !== 0) {
				clearTimeout(timer);
				reject(
					new Error(
						`containers-runner exited early with code ${code}.\n${stderrLog}`,
					),
				);
			}
		});

		rl.on("line", (line) => {
			if (line.startsWith("READY ")) {
				clearTimeout(timer);
				resolve(JSON.parse(line.slice("READY ".length)) as ContainerInfo);
			} else {
				console.log(`[containers-runner] ${line}`);
			}
		});
	});

	const dispose = async (): Promise<void> => {
		await new Promise<void>((resolve) => {
			const forceKill = setTimeout(() => {
				child.kill("SIGKILL");
				resolve();
			}, 15_000);
			child.once("exit", () => {
				clearTimeout(forceKill);
				resolve();
			});
			child.stdin.write("STOP\n");
		});
	};

	return { ...info, dispose };
}

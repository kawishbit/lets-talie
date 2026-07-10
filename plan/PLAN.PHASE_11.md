# Phase 11 — Testcontainers

Replaced the **externally-managed** test infrastructure (the `db-test` + `mailpit-test` services in `docker-compose.yml`, started by hand with `docker compose --profile test up -d`) with **programmatically-provisioned throwaway containers** via [testcontainers-node](https://github.com/testcontainers/testcontainers-node/tree/main/docs). `bun run test:integration` and `bun run test:e2e` now spin up their own Postgres + Mailpit containers on start and tear them down on finish — no manual `docker compose` step, no fixed ports, no shared `letstalie_test` database to reset between runs. Only a running Docker daemon is required.

**Scope:** this only changes how the DB + SMTP dependencies are *provisioned*. The test files themselves (assertions, seed helpers, fixtures, auth cookie signing) did **not** change. Phase 8's unit tests (`vitest.config.ts`, jsdom, no DB) are untouched.

> **Status: done.** All 96 API integration tests, all 31 E2E tests, and all 170 unit tests pass. The final architecture differs substantially from the plan text below (11d–11f) due to a hard blocker discovered mid-implementation — see "What actually shipped" at the end of this file for the real design and why it changed. Left the original plan text in place above that section since the *reasoning trail* (what was tried, what failed, why) is worth keeping for future readers hitting the same wall.

> **⚠️ Superseded (Node migration).** Several facts below are Bun-specific and no longer hold: the app runtime moved from Bun to Node (`drizzle-orm/bun-sql` → `drizzle-orm/postgres-js` + `process.env`, because `bun-sql`'s `import "bun"` crashes on Vercel's Node runtime). Concretely, as of the migration: (a) the app now **has** a Postgres client dependency, `postgres` (postgres-js) — see 11b below, which is now wrong; (b) the orchestrators run via `tsx`, spawn the app server with `node`, and launch migrate/vitest/playwright via plain `bunx` (no `--bun`); (c) the "testcontainers hangs under Bun" workaround (11a) is moot for the app runtime — container provisioning still runs in its own `node` child process, but as a clean boundary, not a Bun escape hatch. The "flip the process hierarchy" fix for the *Vitest* hang (in "What actually shipped") still stands. Bun remains the package manager / task runner only.

## 11a — Spike: confirm testcontainers runs under our runtime

- [x] Confirmed a Docker daemon is reachable (`docker info`).
- [x] Spiked `PostgreSqlContainer` + `GenericContainer` (Mailpit) under `bunx --bun` — **hung indefinitely**. Same exact code, run under plain Node (`node spike.mjs`), resolved in ~1-2s. Confirmed: testcontainers-node's Docker interaction (dockerode's log-follow wait strategies) does not work under the Bun runtime in this environment, even though the container itself starts and becomes healthy at the Docker level.
- [x] Ryuk (resource reaper) works fine under Node; not part of the Bun-specific problem.
- [x] **Fallback taken:** all `testcontainers` / `@testcontainers/postgresql` imports live in one file, [`src/__integration__/helpers/containers-runner.mjs`](../src/__integration__/helpers/containers-runner.mjs), always invoked as a standalone plain-`node` child process — never imported into Bun-run code directly. This does mean a plain `node` binary must be on `PATH` in addition to Bun, a deliberate, flagged exception to CLAUDE.md's "Bun only" rule, scoped narrowly to this one file.

## 11b — Dependencies

- [x] User confirmed adding two devDependencies: `testcontainers` and `@testcontainers/postgresql`, installed via `bun add -d` (never npm/npx).
- [x] ~~No `pg`/`postgres` client dependency needed — migrations and the app server still talk to Postgres via the existing `drizzle-orm/bun-sql`, just pointed at the container's connection URI instead of a static one.~~ **Superseded (Node migration):** the app now uses `drizzle-orm/postgres-js` and declares the `postgres` client as a dependency.

## 11c — Shared container helper

- [x] [`src/__integration__/helpers/containers-runner.mjs`](../src/__integration__/helpers/containers-runner.mjs) — the plain-Node script that actually calls testcontainers: starts `postgres:16-alpine` (via `PostgreSqlContainer`) and `axllent/mailpit:latest` (via `GenericContainer` + `Wait.forListeningPorts()`), then emits a `READY <json>` line on stdout with the connection info and waits on stdin for a `STOP` line (or SIGTERM/SIGINT) to tear both down.
- [x] (added, not in original plan) **`startWithRetry()`** wrapper inside that file: races each container's `.start()` against an external 30s timeout, retrying up to 3 times with a fresh container instance. Needed because testcontainers' own internal startup timeout didn't reliably fire against this Docker Desktop setup — observed hangs where the container was already healthy (per `docker logs`) but the `.start()` promise never resolved. This is defense-in-depth; see "What actually shipped" for the real fix to the *reliable* hang.
- [x] [`src/__integration__/helpers/containers.ts`](../src/__integration__/helpers/containers.ts) — the Bun-safe wrapper: spawns the `.mjs` runner as a child process, parses its `READY` line, and exposes `provisionContainers(): Promise<{ postgresUri, mailpitHost, mailpitSmtpPort, mailpitHttpPort, dispose() }>`.
- [ ] ~~`.withReuse()` for local speed~~ — not implemented. Container startup is already ~1-2s; not worth the added complexity.

## 11d/11e/11f — Original plan (env-injection via `globalSetup`) — superseded, see below

The original plan called for calling `provisionContainers()` from *inside* Vitest's and Playwright's own `globalSetup`, then threading the resulting connection info to worker processes via Vitest's `project.provide()`/`inject()` context (Vitest) and via `process.env` mutation before `webServer`/workers spawn (Playwright).

**This didn't work.** Implemented exactly as planned, `bun run test:integration` reliably hung at container startup — not flaky, reproduced across many consecutive attempts. Root-caused via isolation testing:

1. `provisionContainers()` called directly from a plain `bun run <script>.ts` (no test runner involved) → resolves in ~1-2s, every time.
2. The identical call from inside Vitest's `globalSetup`, using the project's real (Astro-wrapped) `vitest.integration.config.ts` → hangs.
3. The identical call from inside Vitest's `globalSetup`, using a **bare** `defineConfig` from `"vitest/config"` with no Astro/`getViteConfig` involved at all → **also hangs, identically.**

(3) rules out Astro's Vite config wrapper as the cause and implicates Vitest itself — something about Vitest's own process (even though the container-provisioning child is a fully separate OS process from Vitest's) breaks testcontainers' ability to talk to the Docker daemon. The exact mechanism wasn't identified (not worth the further spelunking once a clean architectural fix was available); what's confirmed is that it reproduces with Vitest specifically, not with a bare Bun/Node script, and not with Astro's tooling.

Also observed, and initially misleading: even a `setTimeout`-based external timeout wrapped around the `.start()` call *did* eventually fire correctly (retries logged at clean 30s/60s/90s intervals) — so this is not a fully-frozen event loop, just testcontainers never getting a usable response from Docker while Vitest is anywhere in the process tree.

## What actually shipped — orchestrator scripts, not `globalSetup`

The fix: **flip the process hierarchy.** Instead of Vitest/Playwright spawning the container-provisioning child from inside their own `globalSetup`, a plain Bun script now provisions the containers as the **top-level process** and spawns Vitest/Playwright as *its* child — inheriting `DATABASE_URL` (and friends) via ordinary OS process-env inheritance, no `provide()`/`inject()` machinery needed at all.

- [x] `package.json`: `test:integration` → `bun run src/__integration__/run-integration.ts` (was `bunx --bun vitest run --config ...`). `test:e2e` → `bun run src/__integration__/e2e/run-e2e.ts` (was `bunx --bun playwright test`). _(Node migration: both now run via `tsx …run-*.ts` instead of `bun run`.)_
- [x] [`src/__integration__/run-integration.ts`](../src/__integration__/run-integration.ts) (new) — the orchestrator for the Vitest integration suite. In order: `provisionContainers()` → `drizzle-kit migrate` against the container URI → `astro build` → spawn the standalone server (`bun dist/server/entry.mjs`) against the container DB + Mailpit → wait for it to respond → spawn `bunx --bun vitest run --config vitest.integration.config.ts` as a child, with `DATABASE_URL` / `MAILPIT_TEST_HTTP_PORT` set on its env → propagate its exit code → tear down the server, then the containers (`try`/`finally` at each level so teardown always runs).
- [x] [`src/__integration__/e2e/run-e2e.ts`](../src/__integration__/e2e/run-e2e.ts) (new) — same idea for Playwright, simpler: `provisionContainers()` → migrate → spawn `bunx --bun playwright test` as a child with `DATABASE_URL`/`SMTP_HOST`/`SMTP_PORT`/`MAILPIT_TEST_HTTP_PORT` set. Playwright's own `webServer` (build + run the standalone server) and worker processes inherit those from there — no globalSetup needed for containers at all.
- [x] `vitest.integration.config.ts` — back to simple: reads `DATABASE_URL` from `process.env` (set by the orchestrator before spawning), throws a clear error if missing (i.e. someone ran `vitest run` directly instead of via `bun run test:integration`). No `globalSetup`, no `env-bridge.ts`, no `ProvidedContext` type augmentation — all deleted, none of it was needed once the hierarchy flipped.
- [x] `playwright.config.ts` — same simplification: reads `DATABASE_URL`/`BETTER_AUTH_SECRET` from `process.env` with clear errors if missing; `webServer.env` passes them through explicitly (parity with the pre-Phase-11 shape). No `globalSetup` file — migrations now run in the orchestrator, before `playwright test` even starts.
- [x] Deleted: `src/__integration__/globalSetup.ts`, `src/__integration__/e2e/globalSetup.ts` (logic absorbed into the two orchestrator scripts above).
- [x] `src/__integration__/helpers/mail.ts` — untouched logic-wise, just its comment updated; still reads `MAILPIT_TEST_HTTP_PORT` from `process.env` at module-load time, which now arrives via the orchestrator's env passthrough to the spawned test-runner child (same mechanism Playwright already used pre-Phase-11 for `DATABASE_URL`, just extended to one more var).
- [x] `helpers/auth.ts`, `helpers/db.ts`, `helpers/server.ts`, `setup.ts`, `fixtures.ts` — unchanged.

## 11g — Retire the compose-based test infra

- [x] Removed `db-test` and `mailpit-test` services and the `test` profile from `docker-compose.yml`; kept `db`, `app`, `postgres_data`.
- [x] Removed `TEST_DATABASE_URL`, `DB_TEST_PORT`, `MAILPIT_TEST_SMTP_PORT`, `MAILPIT_TEST_HTTP_PORT` from `.env` / `.env.example` (these are now runtime-only, set by the orchestrators). Kept `TEST_APP_PORT`, `TEST_E2E_PORT` (still configurable, unrelated to containers), and `BETTER_AUTH_SECRET`.
- [ ] ~~Update README.md / AGENTS.md test instructions~~ — checked; neither file referenced the old `docker compose --profile test` step, so nothing needed updating there.

## 11h — CI / environment notes

- [x] Documented (in this file, and in code comments) the Docker-daemon requirement and the plain-`node`-on-`PATH` requirement (for `containers-runner.mjs`).
- [ ] ~~CI image-cache warm step~~ — not addressed; out of scope until this project actually has CI wired up.
- [x] Timeouts: containers provision in ~1-2s in practice; the `startWithRetry` safety net budgets up to ~90s per container before giving up, comfortably inside Vitest/Playwright's existing timeouts (which no longer gate container startup anyway, since it happens before either test runner starts).

## 11i — Verification

- [x] `bun run test:integration` — 96/96 tests pass, zero manual container setup, clean state.
- [x] `bun run test:e2e` — 31/31 tests pass, same.
- [x] `bun run test` — 170/170 unit tests pass, unaffected.
- [x] Ran integration + e2e back-to-back (separate invocations): containers tear down cleanly each time (`docker ps -a` empty after each run; Ryuk self-terminates within ~15s of its watched containers stopping).
- [x] `bun run check` (Biome) — clean on every file this phase touched. (Two pre-existing, unrelated failures found elsewhere in the repo — `logo/banner.html` and `.claude/settings.local.json` — predate this phase and were left alone.)

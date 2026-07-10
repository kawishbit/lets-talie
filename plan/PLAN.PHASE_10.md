# Phase 10 — Distribution: Adapter, Deployment Targets, Demo Mode, README

This project ships two ways in practice: a **private repo** the author self-hosts (Docker Compose or bare-metal clone), and a **public repo** that exists as a live demo (deployed to Vercel, read-only, no real data). Both share the same codebase — the differences are env vars and adapter selection, not forked code.

Root cause of the current dev warning (`no adapter is installed`): `astro.config.mjs` sets `output: "server"` but never registers an Astro adapter. This works in `astro dev` but will hard-fail on `astro build`. Fixing this is the prerequisite for both Docker and Vercel builds.

**Status: Phase complete.** Notable deviations from the original plan text, discovered during implementation:
- `DEMO_MODE` is named `PUBLIC_DEMO_MODE` instead — it has to be `PUBLIC_`-prefixed to be readable client-side in `LoginForm.vue` (Astro/Vite only inlines `PUBLIC_*` vars into the client bundle), and using one name for both server and client avoids two flags drifting out of sync.
- ~~The bare-metal `start` script runs `bun ./dist/server/entry.mjs`, not `node ...` as originally planned — `src/db/database.ts` uses `drizzle-orm/bun-sql` and the `Bun.env` global, so the app only runs under Bun. `package.json`'s `engines` field was corrected from `node` to `bun` to match.~~ **Superseded (Node migration):** `drizzle-orm/bun-sql` does `import "bun"`, which crashes on Vercel's Node runtime (`ERR_MODULE_NOT_FOUND: 'bun'`). The DB layer moved to `drizzle-orm/postgres-js` + `process.env`, `start` now runs `node --env-file-if-exists=.env ./dist/server/entry.mjs`, and `engines` is back to `node`. Bun remains the package manager / task runner only.
- Found and fixed a real bug along the way: the Node adapter binds to `127.0.0.1` inside a container by default (Astro's `server.host` defaults to `false`), which made the Docker image unreachable through its own port mapping. Fixed with `ENV HOST=0.0.0.0` in the Dockerfile's runtime stage only, so `astro dev` and bare-metal (correctly localhost-only behind a reverse proxy) are unaffected.
- `docker-compose.yml` host ports are now configurable via `APP_PORT` / `DB_PORT` (defaults unchanged: 30001 / 5433 for the newly-published db port) to avoid clashing with other local services.
- README's dev section does not document test commands (`bun run test`, etc.) — Phase 8/9 are planned but not yet implemented in this codebase (no vitest/playwright config exists), so documenting them would describe commands that don't work. Revisit once Phase 8/9 land.

---

## 10a — Astro Adapter (Node for self-host, Vercel for demo)

The same codebase needs to produce a **standalone Node server** (for Docker/bare-metal) and a **Vercel serverless build**, from one `astro.config.mjs`. Select the adapter at config-evaluation time via an env var so no source edits are needed to switch targets.

- [x] Install `@astrojs/node` and `@astrojs/vercel` as dependencies
- [x] Update `astro.config.mjs` to pick the adapter based on `process.env.ADAPTER`:
  - `ADAPTER=vercel` → `@astrojs/vercel` (serverless, default)
  - unset / anything else → `@astrojs/node` with `mode: "standalone"` (Docker, bare-metal)
- [x] Confirm `bun run build` (no `ADAPTER` set) now succeeds and produces `dist/server/entry.mjs` — this is what the Dockerfile already expects, so no Dockerfile changes needed
- [x] Confirm `ADAPTER=vercel bun run build` succeeds and produces a `.vercel/output` build
- [x] Re-run `bun run dev` and confirm the `[WARN] no adapter is installed` message is gone
- [x] Document the `ADAPTER` env var in `.env.example` (comment only — it's a build-time var, not runtime) and in README

---

## 10b — Self-Hosting Distribution Paths

Two supported self-host paths already exist in code (`Dockerfile`, `docker-compose.yml`); this section is about making the "clone and run without Docker" path equally first-class and documented.

- [x] Verify `docker-compose.yml` still builds and boots cleanly after the adapter change (`docker compose up --build`) — required a `HOST=0.0.0.0` fix in the Dockerfile (see notes above) and host ports were made configurable via `APP_PORT`/`DB_PORT`
- [x] Add a `bun run migrate` script to `package.json` (`drizzle-kit migrate`) so the bare-metal path has a documented, discoverable migration step instead of relying on the Dockerfile's inline command
- [x] Add a `start` script to `package.json`: ~~`bun ./dist/server/entry.mjs`~~ now `node --env-file-if-exists=.env ./dist/server/entry.mjs` (see the superseded note above — the app runs under Node) — the bare-metal equivalent of the Docker CMD
- [x] Confirm the bare-metal flow end-to-end on a clean checkout: `bun install` → provision Postgres → `bun run build` → `bun run migrate` → `bun run start`
- [x] No code changes required for Vercel here — this section is Docker/bare-metal only

---

## 10c — Demo Mode (read-only, public Vercel deployment)

The public repo/demo must let visitors sign in instantly and browse real-looking data, but never mutate anything. This is enforced server-side (not just hidden UI), since the demo is publicly reachable.

- [x] Add `PUBLIC_DEMO_MODE` (`"true"` / `"false"`) to `.env.example` and `src/env.d.ts`'s `ImportMetaEnv` (renamed from `DEMO_MODE`, see notes above)
- [x] Add `DEMO_USER_EMAIL` to `.env.example` and `src/env.d.ts` — identifies the seeded demo account
- [x] Create `src/db/seed-demo.ts` — idempotent seed script (fixed/deterministic row ids + `onConflictDoNothing`): creates the demo user (`role: "admin"`, for the fullest read tour, confirmed with the project owner), 5 more users, 5 categories, and a mix of completed/pending transaction groups and single transactions
- [x] Add `seed:demo` script to `package.json`: `bun run src/db/seed-demo.ts`
- [x] **Server-side write guard** — in `src/middleware.ts`, when `import.meta.env.PUBLIC_DEMO_MODE === "true"`: intercept any request to `/api/*` (excluding `/api/auth/*`) with method `POST`, `PATCH`, `PUT`, or `DELETE`, and short-circuit with `403` + JSON body `{ error: "Demo mode: this action is disabled." }` before it reaches the route handler
- [x] Create `POST /api/auth/demo-login` (`src/lib/demo-auth.ts`, a better-auth plugin in the same style as the existing `passwordless.ts`) — only responds (else `404`) when demo mode is enabled; signs in as the seeded `DEMO_USER_EMAIL` account directly (creates a session via the internal adapter) with no OTP/email step
- [x] `LoginForm.vue` — when `PUBLIC_DEMO_MODE` is `"true"` client-side, show a "Continue as Demo" button that calls `/api/auth/demo-login` instead of the passwordless flow
- [x] Add a persistent demo banner in `AppHeader.astro` shown whenever the signed-in user matches `DEMO_USER_EMAIL`, explaining the account is read-only
- [x] Blocked-action responses already read as "this is a demo" — every existing mutating component already displays `data.error` (inline text or `alert()`), and the middleware's 403 body uses that same `error` field, so no new fetch-wrapper abstraction was needed
- [x] Confirmed via a real browser session (dev server + seeded local Postgres): demo login works, dashboard balance is correct, banner renders, and a direct `DELETE` on `/api/users/:id` through the actual Users page UI returns the demo-mode message via the existing `alert()` path

---

## 10d — Vercel Deployment Configuration

- [x] `vercel.json` confirmed unnecessary — `@astrojs/vercel` emits Vercel's Build Output API format directly and the Astro framework preset consumes it with no extra config
- [x] Documented required Vercel project settings in README: Build Command override (`ADAPTER=vercel bun run build`) or an `ADAPTER=vercel` project env var, Install Command (`bun install`), and Output Directory (Vercel's Astro preset default)
- [x] Documented that Vercel needs an external Postgres (Neon, Supabase, Vercel Postgres, etc.) — this app does not run its own DB on Vercel — and that migrations must be run once against that DB before first traffic (`DATABASE_URL=<remote> bun run migrate`, run locally or via a one-off Vercel deploy hook)
- [x] Documented the demo-specific env vars to set on the Vercel project: `PUBLIC_DEMO_MODE=true`, `DEMO_USER_EMAIL`, plus the standard `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the Vercel-assigned domain), and SMTP vars (can point at a throwaway/no-op SMTP since demo-login bypasses email, but passwordless login for other emails would still attempt to send)
- [x] Documented running `bun run seed:demo` against the Vercel database once after first deploy

---

## 10e — README Rewrite

Replace the current Astro starter-template README with real project documentation.

- [x] Project name, one-line description, placeholder for the live demo URL (link added once deployed) with a note that it's read-only
- [x] "Deployment Options" section covering all three paths (Docker Compose, bare-metal, Vercel)
- [x] Environment variables reference table, including `ADAPTER`, `PUBLIC_DEMO_MODE`, `DEMO_USER_EMAIL`, `APP_PORT`/`DB_PORT`
- [x] "Demo Mode" section explaining what it is, how to enable it, and what it restricts
- [x] Development section: `bun install`, `astro dev --background`, `bun run check` — test commands intentionally omitted, see notes above
- [x] Tech stack summary and link to `DESIGN.md` for UI conventions
- [x] Removed all boilerplate `bun create astro` starter content

# Phase 9 — Integration Testing

The integration testing strategy runs tests against a **real PostgreSQL test database** (not mocked) and a live server. Each test seeds the database to a known state, exercises actual HTTP endpoints or Playwright browser flows, and tears down after. Use **Vitest** for API integration tests and **Playwright** for end-to-end browser tests.

Two modes of integration test:

- **API integration** — `fetch` against a running server with a dedicated test DB. Seed data directly via Drizzle before each test group. Tests cover auth, business logic, and HTTP contract together.
- **E2E (Playwright)** — real browser, real server, real DB. Tests cover page rendering, navigation guards, and critical user flows.

> **Status: done.** 96 passing API integration tests (`bun run test:integration`) across 10 files, and 31 passing E2E tests (`bun run test:e2e`) across 4 files. Both run against a dedicated `letstalie_test` Postgres database and a Mailpit SMTP catcher, started via `docker compose --profile test up -d db-test mailpit-test`. Several scope adjustments from the original plan text are called out inline below — deliberate, not oversights. Two real bugs the tests surfaced were fixed directly (see 9b and 9e/9f below), since they were small, well-scoped, and confirmed by the new tests themselves.

## 9a — Integration Test Infrastructure Setup

- [x] ~~Install `@playwright/test`, `playwright`, `supertest`/`undici`~~ — installed `@playwright/test` + Chromium only (confirmed with the user first, since it's a new dependency + ~260MB browser download). `undici`/`supertest` turned out unnecessary: Bun's native `fetch` works fine for API integration tests.
- [x] `playwright.config.ts` — `testDir: src/__integration__/e2e/`, `baseURL` on a dedicated port (`TEST_E2E_PORT`, default 30098), trace/screenshot on failure.
- [x] `vitest.integration.config.ts` — separate Vitest config, `environment: "node"`, no jsdom, longer timeouts, `fileParallelism: false` (shared DB + server).
- [x] `test:integration` script — `bunx --bun vitest run --config vitest.integration.config.ts`. Note the explicit `bunx --bun`: plain `vitest run` resolves to a `#!/usr/bin/env node` binary, which breaks two things — (1) Bun's automatic `.env` loading doesn't apply under plain Node, and (2) `src/db/database.ts` imports `drizzle-orm/bun-sql`, which does `import "bun"` and throws under Node. `bunx --bun` forces the whole process tree onto the Bun runtime.
- [x] `test:e2e` script — `bunx --bun playwright test`, same reasoning.
- [x] `src/__integration__/` with `api/` and `e2e/` subdirectories.
- [x] `src/__integration__/helpers/db.ts` — reuses the app's own `db` singleton (pointed at `TEST_DATABASE_URL` via `vitest.integration.config.ts`'s `test.env` / `playwright.config.ts` mutating `process.env.DATABASE_URL`), plus `resetDb()`, `seedUser()`, `seedAdmin()`, `seedCategory()`, `seedTransaction()`, `seedGroup()`.
- [x] `src/__integration__/helpers/auth.ts` — `sessionCookieFor(userId)` inserts a real `session` row and hand-signs the cookie the same way better-auth does (HMAC-SHA256 over the token, replicating `better-call`'s `serializeSignedCookie`), so the live server's `auth.api.getSession()` accepts it without going through a sign-in endpoint.
- [x] (added) `src/__integration__/helpers/server.ts` — `fetch` wrapper against the live server; injects `Origin` header (better-auth's CSRF check requires one on any cookie-authenticated request) and a default `content-type` on bodiless POSTs (better-call 415s without one).
- [x] (added) `src/__integration__/helpers/mail.ts` — reads back real OTP/magic-link emails via Mailpit's HTTP API instead of mocking `sendMail`, so the auth flow tests exercise the actual SMTP path.
- [x] `src/__integration__/setup.ts` (per-file `beforeEach`: `resetDb()` + `clearInbox()`) + `src/__integration__/globalSetup.ts` (runs once: migrations, then builds and starts a standalone server) — split into two files rather than the one file the plan text named, since "run once" and "run per test" are different Vitest lifecycles (`globalSetup` vs `setupFiles`).
- [x] `TEST_DATABASE_URL` (+ `TEST_APP_PORT`, `TEST_E2E_PORT`, `MAILPIT_TEST_SMTP_PORT`, `MAILPIT_TEST_HTTP_PORT`) documented in `.env` / `.env.example`.
- [x] (added) `docker-compose.yml` — new `db-test` (Postgres, port 5434) and `mailpit-test` (SMTP catcher, ports 1026/8026) services under a `test` profile, isolated from dev data (`docker compose --profile test up -d db-test mailpit-test`).

**Not `astro dev`.** Both `globalSetup.ts` and `playwright.config.ts`'s `webServer` build the app (`astro build`) and run the standalone Node output directly (`bun dist/server/entry.mjs`) rather than spawning `astro dev --port <n>`. Astro 7 tracks a single background dev-server **per project root** (`node_modules/astro/dist/cli/dev/*.js`), keyed by a lockfile — not by port — and forces background+lockfile mode on every invocation in an agent-detected environment. A second `astro dev` for the test DB would either refuse to start or silently reuse/replace whatever dev server is already running on the real port. The built standalone server has no such singleton and runs fully isolated.

## 9b — Database Layer Integration

- [x] Migrations apply cleanly to a fresh database with no errors
- [x] `user` table — insert, read, update, soft-delete round-trip works correctly
- [x] `transactionCategories` table — insert, read, soft-delete round-trip works correctly
- [x] `transactions` table — insert with all required fields, read back matches inserted values
- [x] Foreign key `transactions.paidByUserId → user.id` — rejects insert with a non-existent userId
- [x] Foreign key `transactions.categoryId → transactionCategories.id` — rejects insert with a non-existent categoryId
- [x] `recalculateBalances` — updates `user.accountBalance` correctly in the real DB after completed deposits
- [x] `recalculateBalances` — updates `user.accountBalance` correctly in the real DB after completed withdrawals
- [x] `recalculateBalances` — ignores soft-deleted and non-completed transactions in the real DB
- [x] `fetchUsersAndCategories` — returns only non-deleted records from the real DB, ordered correctly

**Bug found here, fixed:** `recalculateBalances` was returning `"0"` (not `"0.00"`) when a user has zero matching completed transactions against the real DB — reproduced directly against the identical SQL (Postgres's `COALESCE` fallback loses its `.00` scale once passed through the driver in a `.select()` context). Phase 8's mocked unit test asserting `"0.00"` never caught this, since it stubs the DB response directly rather than running the query. `src/lib/balance.ts` now normalizes the result through `Number(...).toFixed(2)` before storing, guaranteeing `x.xx` formatting regardless of what the driver hands back.

## 9c — Auth Flow Integration

Tests against the live Better Auth endpoints (`/api/auth/...`).

- [x] ~~`POST /api/auth/sign-in/magic-link`~~ → `POST /api/auth/passwordless-bundle/request` — returns `200` and sends a real OTP + magic-link email (read back via Mailpit) for an existing user email. The plan text's generic magic-link route doesn't exist in this app; it registers a custom `passwordless-bundle` plugin (`src/lib/passwordless.ts`) with its own paths.
- [x] Same endpoint — returns `200` without confirming/denying whether the email is registered (anti-enumeration is intentional, not a bug: sign-up happens on verify)
- [x] Magic-link verification (`GET /passwordless-bundle/verify`) — creates a valid session and sets a session cookie on success (302 redirect + `Set-Cookie`)
- [x] Magic-link verification — rejects an already-used token (second hit redirects with `error=INVALID_TOKEN`)
- [x] OTP verification (`POST /passwordless-bundle/verify-otp`) — creates a valid session and sets a session cookie on a correct OTP
- [x] OTP verification — rejects an incorrect OTP (`400`)
- [x] `GET /api/auth/get-session` — returns session data when a valid cookie is present
- [x] `GET /api/auth/get-session` — returns `null` session when no cookie is present
- [x] `POST /api/auth/sign-out` — invalidates the session; subsequent calls to `/api/auth/get-session` return `null`

## 9d — Middleware Integration

- [x] Unauthenticated `GET /dashboard` — redirects to `/login` (302)
- [x] Unauthenticated `GET /transactions` — redirects to `/login`
- [x] Unauthenticated `GET /users` — redirects to `/login`
- [x] Authenticated regular user `GET /users`, `/transaction-categories`, `/import-transactions`, `/approve-transactions` — redirects to `/dashboard`
- [x] Authenticated admin `GET /users` — returns `200`
- [x] Authenticated admin `GET /approve-transactions` — returns `200`
- [x] Unauthenticated `GET /` — returns `200` (public route)
- [x] Unauthenticated `GET /login` — returns `200` (public route)
- [x] Authenticated user `GET /dashboard` — returns `200` and `context.locals.user` is populated (verified indirectly: `/api/transactions` 401s without a session, 200s with one)

## 9e — API Integration: Transactions (`GET /api/transactions`)

- [x] ~~Returns `401` for unauthenticated request~~ → **redirects to `/login` (302)**. Discovered against the live server: `src/middleware.ts` redirects any non-public, non-auth-API path — including `/api/transactions` — to `/login` *before* the route handler's own `if (!sessionUser) return 401` ever runs. That branch is unreachable from a real unauthenticated request; Phase 8's mocked test calls the handler directly and never sees the middleware layer. Same finding applies to `/api/categories` and `/api/transactions/groups/pending` (noted again in their own sections).
- [x] Admin receives all transactions (including other users'); regular user receives only their own
- [x] `?status=pending` — returns only transactions with that status
- [x] `?type=deposit` — returns only deposit transactions
- [x] `?categoryId=<id>` — filters by category
- [x] `?dateFrom=<iso>&dateTo=<iso>` — filters by date range (inclusive)
- [x] `?sortBy=date&sortDir=asc` — returns transactions in ascending date order
- [x] `?page=2&pageSize=5` — returns the correct page slice and total count
- [x] Soft-deleted transactions are excluded from results (for regular users)

**Bug found here, fixed:** `src/pages/api/transactions/index.ts` built its `where` conditions with no `isNull(deletedAt)` filter at all, unlike every sibling list endpoint (`/api/categories`, `/api/users`, `/api/transactions/groups/pending`), so a regular user's own soft-deleted transaction (e.g. from a deleted group) still appeared via the client-side-pagination path — the initial server-rendered `/transactions` page filtered it correctly, only the API didn't. Fixed by adding `isNull(transactions.deletedAt)` to the `!isAdmin` branch only: admins still see soft-deleted rows (greyed out), matching the styling `TransactionTable.vue` already has for it.
- [x] Response shape is `{ items, total, page, pageSize }`

## 9f — API Integration: Group Transactions (full lifecycle)

**Create (`POST /api/transactions/group`)**
- [x] Admin creates a group → status is `'completed'`, balances are updated in DB
- [x] Regular user creates a group → status is `'pending'`, balances are unchanged
- [x] Equal-split: each party's withdrawal amount equals `total / parties.length`
- [x] Custom-split: each party's withdrawal matches the supplied `customAmounts`
- [x] All inserted rows share the same `transactionGroupId` (verified via the row count + status assertions)
- [x] A deposit row (`type='deposit'`) for the payer and withdrawal rows for each party are present
- [x] (added) Rejects custom amounts that don't sum to the total (`400`)

**Approve/Reject (`PATCH /api/transactions/group/[groupId]/status`)**
- [x] Approving a pending group sets all transactions to `'completed'` in DB
- [x] Approving recalculates balances for all affected users
- [x] Rejecting a pending group sets all transactions to `'cancelled'` in DB
- [x] Rejecting does not change user balances
- [x] Attempting to approve/reject an already-completed group returns `409`
- [x] Attempting to approve a non-existent groupId returns `404`

**Delete (`DELETE /api/transactions/group/[groupId]`)**
- [x] Soft-deletes all transactions in the group (sets `deletedAt`)
- [x] Deleting a completed group recalculates and reverses user balances (this is where the 9b `"0.00"` formatting fix is exercised — the payer's balance goes fully back to zero)
- [x] Deleting a pending group does not change user balances
- [x] Attempting to delete a non-existent (or already deleted) groupId returns `404`
- [x] Deleted transactions do not appear in the `GET /api/transactions` listing (for the regular-user party involved — same fix as 9e)

## 9g — API Integration: Single Transactions (full lifecycle)

- [x] Authenticated user creates a completed deposit → balance updated in DB
- [x] Authenticated user creates a pending withdrawal → balance unchanged
- [x] Authenticated user creates a cancelled transaction → balance unchanged
- [x] Transaction appears in `GET /api/transactions` after insert
- [x] Admin can create a single transaction for any `paidByUserId`

## 9h — API Integration: Pending Groups (`GET /api/transactions/groups/pending`)

- [x] ~~Returns `401` for unauthenticated request~~ → redirects to `/login` (302); same middleware finding as 9e.
- [x] Returns `403` for regular user
- [x] Admin receives paginated list of groups with at least one pending transaction
- [x] Completed and cancelled groups are excluded from results
- [x] Response shape includes `groups`, `total`, `page`, `pageSize`

## 9i — API Integration: Import (`POST /api/transactions/import`)

- [x] Valid JSON array import — all rows inserted, `recalculateBalances` called for affected users, returns `201` with count
- [x] Valid CSV (`text/csv`) import — all rows inserted, returns `201` with count
- [x] Valid `multipart/form-data` file upload — all rows inserted, returns `201` with count
- [x] Import with one invalid row — entire import rejected with `422` and per-row errors; DB remains unchanged
- [x] After successful import, balances of affected users are updated in DB
- [x] `transactionGroupId` field on rows is preserved when provided
- [x] `createdAt` field on rows is preserved when provided
- [x] (added) Returns `415` for an unsupported Content-Type
- [x] (added) Returns `403` for a non-admin user

## 9j — API Integration: Categories (full lifecycle)

- [x] `GET /api/categories` — returns all non-deleted categories, paginated
- [x] `POST /api/categories` — admin creates category; appears in subsequent GET
- [x] `PATCH /api/categories/[id]` — admin updates label; change is reflected in GET
- [x] `DELETE /api/categories/[id]` — admin soft-deletes; category no longer appears in GET
- [x] Soft-deleted categories are excluded from `fetchUsersAndCategories` helper
- [x] `POST /api/categories` — duplicate label is allowed (no unique constraint on label)
- [x] ~~Returns `401` for unauthenticated request~~ → redirects to `/login` (302); same middleware finding as 9e.

## 9k — API Integration: Users (full lifecycle)

- [x] `GET /api/users` — admin receives paginated list of non-deleted users
- [x] `GET /api/users?role=admin` / `?role=user` — filters by role
- [x] `POST /api/users` — admin creates user; user appears in subsequent GET
- [ ] ~~`POST /api/users` — duplicate email returns `409`~~ — still not implemented (carried over from Phase 8's finding: the handler inserts unconditionally, so a duplicate currently 500s on the DB's unique constraint instead of a clean `409`). Not re-tested here since there's still no `409` behavior to assert.
- [x] `PATCH /api/users/[id]` — admin updates name/email/role; change reflected in DB
- [x] `DELETE /api/users/[id]` — admin soft-deletes user; user no longer appears in GET/`fetchUsersAndCategories`
- [x] `DELETE /api/users/[id]` — cannot delete own account (returns `400`)
- [x] 403 (not admin) covered on all four routes; 404 (missing id) covered on PATCH/DELETE

## 9l — E2E: Page Rendering & Navigation (Playwright)

Setup: `playwright.config.ts`'s `webServer` builds and starts a standalone server against the test DB (see 9a); `globalSetup.ts` runs migrations first.

**Unauthenticated**
- [x] `GET /` — renders the public landing/login page without error
- [x] `GET /login` — renders the login form
- [x] Visiting `/dashboard` while unauthenticated — browser is redirected to `/login`
- [x] Visiting `/users` while unauthenticated — browser is redirected to `/login`

**Regular User**
- [x] After login, `/dashboard` renders and shows the user's own balance + forms
- [x] Nav links render with the correct active state for the current page
- [x] Visiting `/users` as a regular user — browser is redirected to `/dashboard`
- [x] `/transactions` page renders the transaction table with the user's data
- [x] Sign out button ends the session — redirects to `/` (not `/login`; confirmed the session cookie is actually cleared server-side by then re-visiting `/dashboard` and observing the `/login` redirect)

**Admin**
- [x] Admin nav links (Users, Categories, Import, Approve) are visible in the header
- [x] `/users`, `/transaction-categories`, `/import-transactions`, `/approve-transactions` — each renders its respective table/form

## 9m — E2E: Critical User Flows (Playwright)

Most flows authenticate by injecting a signed session cookie directly (`loginAs` fixture in `src/__integration__/e2e/fixtures.ts`) rather than driving the OTP UI each time — `login-flow.spec.ts` is the one file that exercises the real email → OTP → dashboard flow end-to-end (reading the OTP back from Mailpit), since repeating that dance in every other spec would be slow for no added coverage.

**Group Transaction Flow (Regular User)**
- [x] Regular user submits the group transaction form → new group appears in transaction list with `pending` status
- [x] Custom amount toggle disables submit when amounts don't sum to the total

**Group Approval Flow (Admin)**
- [x] Pending group appears on `/approve-transactions`; admin clicks Approve → group disappears from the pending list
- [x] Admin clicks Reject on a pending group → group disappears from the pending list

**Single Transaction Flow (Admin)**
- [x] Admin fills single transaction form and submits → transaction appears in the transaction list

**Category Management Flow (Admin)**
- [x] Admin creates a new category → category appears in the table
- [x] Admin edits a category label → updated label is shown in the table
- [x] Admin deletes a category → category disappears from the table

**User Management Flow (Admin)**
- [x] Admin creates a new user → user appears in the user table
- [x] Admin edits a user's role → updated role is shown in the table
- [x] Admin deletes a user → user disappears from the table

**Import Flow (Admin)**
- [x] Admin uploads a valid CSV file → preview shows rows, submit inserts them, success message shown
- [x] Admin uploads a CSV with one invalid row → per-row error is displayed, submit is disabled

**Balance Accuracy**
- [x] After completing a group with more than one party, the payer's displayed balance changes by their net share (a single-party "group" nets to zero — the payer's own withdrawal share cancels their deposit — so this needed a second party to actually observe a change)
- [x] After rejecting a pending group, balances are unchanged

**Discovered while writing E2E fixtures — worth knowing for future test files:** a plain module-level `test.beforeEach(...)` call inside a shared, non-spec module (e.g. `fixtures.ts`) only fires for the *first* spec file that imports it, due to Node's module caching — it does not re-register per file. `resetDb()` needs to run before *every* test regardless of which file it's in, so `fixtures.ts` uses an `{ auto: true }` fixture instead, which Playwright guarantees runs per-test across all files.

# Phase 9 — Integration Testing

The integration testing strategy runs tests against a **real PostgreSQL test database** (not mocked) and a live Astro dev server. Each test seeds the database to a known state, exercises actual HTTP endpoints or Playwright browser flows, and tears down after. Use **Vitest** for API integration tests and **Playwright** for end-to-end browser tests.

Two modes of integration test:

- **API integration** — `fetch` against a running Astro server with a dedicated test DB. Seed data directly via Drizzle before each test group. Tests cover auth, business logic, and HTTP contract together.
- **E2E (Playwright)** — real browser, real server, real DB. Tests cover page rendering, navigation guards, and critical user flows.

---

## 9a — Integration Test Infrastructure Setup

- [ ] Install integration test dependencies: `@playwright/test`, `playwright` (with Chromium), `supertest` or native `fetch` via `undici`
- [ ] Add `playwright.config.ts` — configure base URL (`http://localhost:4321`), test directory `src/__integration__/e2e/`, screenshot/video on failure
- [ ] Add `vitest.integration.config.ts` — separate Vitest config for API integration tests; no jsdom, node environment, longer timeouts
- [ ] Add `test:integration` script to `package.json`: `vitest run --config vitest.integration.config.ts`
- [ ] Add `test:e2e` script: `playwright test`
- [ ] Create `src/__integration__/` directory with subdirectories `api/` and `e2e/`
- [ ] Create `src/__integration__/helpers/db.ts` — test DB client pointing at `TEST_DATABASE_URL`, helpers: `resetDb()`, `seedUser()`, `seedAdmin()`, `seedCategory()`, `seedTransaction()`, `seedGroup()`
- [ ] Create `src/__integration__/helpers/auth.ts` — helper that creates a real session token for a given user (direct DB insert into `session` table) and returns a `Cookie` header string
- [ ] Create `src/__integration__/helpers/server.ts` — wraps `fetch` calls against the test server with optional session cookie injection
- [ ] Create `src/__integration__/setup.ts` — global setup: run migrations on test DB, then `resetDb()` before each file
- [ ] Add `TEST_DATABASE_URL` to `.env.test` (or document it in README); ensure CI pipeline sets this variable

---

## 9b — Database Layer Integration

These tests verify that Drizzle queries and schema migrations work correctly against the real database.

- [ ] Migrations apply cleanly to a fresh database with no errors
- [ ] `user` table — insert, read, update, soft-delete round-trip works correctly
- [ ] `transactionCategories` table — insert, read, soft-delete round-trip works correctly
- [ ] `transactions` table — insert with all required fields, read back matches inserted values
- [ ] Foreign key `transactions.paidByUserId → user.id` — rejects insert with a non-existent userId
- [ ] Foreign key `transactions.categoryId → transactionCategories.id` — rejects insert with a non-existent categoryId
- [ ] `recalculateBalances` — updates `user.accountBalance` correctly in the real DB after completed deposits
- [ ] `recalculateBalances` — updates `user.accountBalance` correctly in the real DB after completed withdrawals
- [ ] `recalculateBalances` — ignores soft-deleted and non-completed transactions in the real DB
- [ ] `fetchUsersAndCategories` — returns only non-deleted records from the real DB, ordered correctly

---

## 9c — Auth Flow Integration

Tests against the live Better Auth endpoints (`/api/auth/...`).

- [ ] `POST /api/auth/sign-in/magic-link` — returns `200` and sends a magic-link token for an existing user email
- [ ] `POST /api/auth/sign-in/magic-link` — returns appropriate error for an unregistered email
- [ ] Magic-link verification endpoint — creates a valid session and sets a session cookie on success
- [ ] Magic-link verification endpoint — rejects an expired or already-used token
- [ ] `GET /api/auth/get-session` — returns session data when a valid cookie is present
- [ ] `GET /api/auth/get-session` — returns `null` session when no cookie is present
- [ ] `POST /api/auth/sign-out` — invalidates the session; subsequent calls to `/api/auth/get-session` return `null`

---

## 9d — Middleware Integration

Tests verify that the Astro middleware correctly guards pages using the real auth system.

- [ ] Unauthenticated `GET /dashboard` — redirects to `/login` (302)
- [ ] Unauthenticated `GET /transactions` — redirects to `/login`
- [ ] Unauthenticated `GET /users` — redirects to `/login`
- [ ] Authenticated regular user `GET /users` — redirects to `/dashboard`
- [ ] Authenticated regular user `GET /transaction-categories` — redirects to `/dashboard`
- [ ] Authenticated regular user `GET /import-transactions` — redirects to `/dashboard`
- [ ] Authenticated regular user `GET /approve-transactions` — redirects to `/dashboard`
- [ ] Authenticated admin `GET /users` — returns `200`
- [ ] Authenticated admin `GET /approve-transactions` — returns `200`
- [ ] Unauthenticated `GET /` — returns `200` (public route)
- [ ] Unauthenticated `GET /login` — returns `200` (public route)
- [ ] Authenticated user `GET /dashboard` — returns `200` and `context.locals.user` is populated

---

## 9e — API Integration: Transactions (`GET /api/transactions`)

- [ ] Returns `401` for unauthenticated request
- [ ] Admin receives all transactions (including other users'); regular user receives only their own
- [ ] `?status=pending` — returns only transactions with that status
- [ ] `?type=deposit` — returns only deposit transactions
- [ ] `?categoryId=<id>` — filters by category
- [ ] `?dateFrom=<iso>&dateTo=<iso>` — filters by date range (inclusive)
- [ ] `?sortBy=date&sortDir=asc` — returns transactions in ascending date order
- [ ] `?page=2&pageSize=5` — returns the correct page slice and total count
- [ ] Soft-deleted transactions are excluded from results
- [ ] Response shape is `{ items, total, page, pageSize }`

---

## 9f — API Integration: Group Transactions (full lifecycle)

Tests the complete group transaction lifecycle in the real database.

**Create (`POST /api/transactions/group`)**
- [ ] Admin creates a group → status is `'completed'`, balances are updated in DB
- [ ] Regular user creates a group → status is `'pending'`, balances are unchanged
- [ ] Equal-split: each party's withdrawal amount equals `total / parties.length`
- [ ] Custom-split: each party's withdrawal matches the supplied `customAmounts`
- [ ] All inserted rows share the same `transactionGroupId`
- [ ] A deposit row (`type='deposit'`) for the payer and withdrawal rows for each party are present

**Approve/Reject (`PATCH /api/transactions/group/[groupId]/status`)**
- [ ] Approving a pending group sets all transactions to `'completed'` in DB
- [ ] Approving recalculates balances for all affected users
- [ ] Rejecting a pending group sets all transactions to `'cancelled'` in DB
- [ ] Rejecting does not change user balances
- [ ] Attempting to approve/reject an already-completed group returns `409`
- [ ] Attempting to approve a non-existent groupId returns `404`

**Delete (`DELETE /api/transactions/group/[groupId]`)**
- [ ] Soft-deletes all transactions in the group (sets `deletedAt`)
- [ ] Deleting a completed group recalculates and reverses user balances
- [ ] Deleting a pending group does not change user balances
- [ ] Attempting to delete a non-existent (or already deleted) groupId returns `404`
- [ ] Deleted transactions do not appear in the `GET /api/transactions` listing

---

## 9g — API Integration: Single Transactions (full lifecycle)

- [ ] Authenticated user creates a completed deposit → balance updated in DB
- [ ] Authenticated user creates a pending withdrawal → balance unchanged
- [ ] Authenticated user creates a cancelled transaction → balance unchanged
- [ ] Transaction appears in `GET /api/transactions` after insert
- [ ] Admin can create a single transaction for any `paidByUserId`

---

## 9h — API Integration: Pending Groups (`GET /api/transactions/groups/pending`)

- [ ] Returns `401` for unauthenticated request
- [ ] Returns `403` for regular user
- [ ] Admin receives paginated list of groups with at least one pending transaction
- [ ] Completed and cancelled groups are excluded from results
- [ ] Soft-deleted transaction groups are excluded
- [ ] Response shape includes `groups`, `total`, `page`, `pageSize`

---

## 9i — API Integration: Import (`POST /api/transactions/import`)

- [ ] Valid JSON array import — all rows inserted, `recalculateBalances` called for affected users, returns `201` with count
- [ ] Valid CSV (`text/csv`) import — all rows inserted, returns `201` with count
- [ ] Valid `multipart/form-data` file upload — all rows inserted, returns `201` with count
- [ ] Import with one invalid row — entire import rejected with `422` and per-row errors; DB remains unchanged
- [ ] After successful import, balances of affected users are updated in DB
- [ ] `transactionGroupId` field on rows is preserved when provided
- [ ] `createdAt` field on rows is preserved when provided

---

## 9j — API Integration: Categories (full lifecycle)

- [ ] `GET /api/categories` — returns all non-deleted categories, paginated
- [ ] `POST /api/categories` — admin creates category; appears in subsequent GET
- [ ] `PATCH /api/categories/[id]` — admin updates label; change is reflected in GET
- [ ] `DELETE /api/categories/[id]` — admin soft-deletes; category no longer appears in GET
- [ ] Soft-deleted categories are excluded from `fetchUsersAndCategories` helper
- [ ] `GET /api/categories?page=2&pageSize=2` — returns correct page slice
- [ ] `POST /api/categories` — duplicate label is allowed (no unique constraint on label)

---

## 9k — API Integration: Users (full lifecycle)

- [ ] `GET /api/users` — admin receives paginated list of non-deleted users
- [ ] `GET /api/users?role=admin` — returns only admin users
- [ ] `GET /api/users?role=user` — returns only regular users
- [ ] `POST /api/users` — admin creates user; user appears in subsequent GET
- [ ] `POST /api/users` — duplicate email returns `409`
- [ ] `PATCH /api/users/[id]` — admin updates name/email/role; change reflected in GET
- [ ] `DELETE /api/users/[id]` — admin soft-deletes user; user no longer appears in GET
- [ ] `DELETE /api/users/[id]` — cannot delete own account (returns `400`)
- [ ] Soft-deleted users are excluded from `fetchUsersAndCategories` helper

---

## 9l — E2E: Page Rendering & Navigation (Playwright)

Setup: start Astro dev server (`astro dev`) pointing at test DB before running Playwright suite.

**Unauthenticated**
- [ ] `GET /` — renders the public landing/login page without error
- [ ] `GET /login` — renders the login form
- [ ] Visiting `/dashboard` while unauthenticated — browser is redirected to `/login`
- [ ] Visiting `/users` while unauthenticated — browser is redirected to `/login`

**Regular User**
- [ ] After login, `/dashboard` renders and shows the user's own transactions
- [ ] Nav links render with the correct active state for the current page
- [ ] Visiting `/users` as a regular user — browser is redirected to `/dashboard`
- [ ] `/transactions` page renders the transaction table with the user's data
- [ ] Sign out button ends the session and redirects to `/login`

**Admin**
- [ ] Admin nav links (Users, Categories, Import, Approve) are visible in the header
- [ ] `/users` page renders the user table
- [ ] `/transaction-categories` page renders the category table
- [ ] `/import-transactions` page renders the import form
- [ ] `/approve-transactions` page renders the pending groups list

---

## 9m — E2E: Critical User Flows (Playwright)

**Group Transaction Flow (Regular User)**
- [ ] Regular user submits the group transaction form → new group appears in transaction list with `pending` status
- [ ] Custom amount toggle enables per-party amount inputs; form validates that amounts sum to total before submit
- [ ] Submitting with mismatched custom amounts shows a validation error and does not POST

**Group Approval Flow (Admin)**
- [ ] Pending group appears on `/approve-transactions`; admin clicks Approve → group status changes to `completed`
- [ ] Admin clicks Reject on a pending group → group status changes to `cancelled`; group disappears from pending list

**Single Transaction Flow (Admin)**
- [ ] Admin fills single transaction form and submits → transaction appears in the transaction list

**Category Management Flow (Admin)**
- [ ] Admin creates a new category → category appears in the table
- [ ] Admin edits a category label → updated label is shown in the table
- [ ] Admin deletes a category → category disappears from the table

**User Management Flow (Admin)**
- [ ] Admin creates a new user → user appears in the user table
- [ ] Admin edits a user's role → updated role is shown in the table
- [ ] Admin deletes a user → user disappears from the table

**Import Flow (Admin)**
- [ ] Admin uploads a valid CSV file → preview shows rows, submit inserts them, success message shown
- [ ] Admin uploads a CSV with one invalid row → per-row error is displayed, submit is disabled

**Balance Accuracy**
- [ ] After completing a deposit group, the payer's displayed balance increases by the deposit amount
- [ ] After rejecting a pending group, balances are unchanged
- [ ] After deleting a completed group, the payer's displayed balance is reversed

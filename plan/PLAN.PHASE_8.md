# Phase 8 — Unit Testing

The testing strategy is **unit-first**: isolate and test each piece of business logic, each API route handler, and each utility in isolation. Use **Vitest** as the test runner (compatible with Bun and the Vite/Astro build pipeline). Database calls are mocked with `vi.mock`. Vue components are tested with **@vue/test-utils** + **@testing-library/vue**.

> **Status: done.** 170 tests across 21 files, all passing (`bun run test`). Coverage (`bun run test:coverage`) is scoped to the units below and clears the 70% threshold on statements/branches/functions/lines. Two scope adjustments from the original plan are called out inline — both were deliberate, not oversights.

## 8a — Test Infrastructure Setup

- [x] Install test dependencies: `vitest`, `@vitest/coverage-v8`, `@vue/test-utils`, `@testing-library/vue`, `jsdom`
- [x] Add `vitest.config.ts` — configure environment (`jsdom`), path aliases (`@db`, `@lib`), coverage thresholds. Built on Astro's `getViteConfig()` helper (from `astro/config`) so the Vue SFC compiler and tsconfig path aliases come for free — no extra `@vitejs/plugin-vue` dependency needed.
- [x] Add `test` script to `package.json`: `vitest run`
- [x] Add `test:coverage` script: `vitest run --coverage`
- [x] Add `test:watch` script: `vitest`
- [x] Create `src/__tests__/` directory for unit tests
- [x] Create `src/__tests__/setup.ts` — global test setup (stubs env vars, mocks `@db/database` globally with `vi.fn()`-based `select`/`insert`/`update`/`transaction`)

API-route, middleware, and business-logic test files run under `// @vitest-environment node` (set per-file) rather than the jsdom default — jsdom's `File`/`FormData` implementation doesn't round-trip through `Request.formData()` correctly, which broke multipart import tests. Only Vue component tests use jsdom. A shared chainable/thenable Drizzle query-builder mock lives in `src/__tests__/helpers/db.ts` (`createChain`).

## 8b — Business Logic: `src/lib/balance.ts`

- [x] `recalculateBalances` — skips update when `userIds` is empty
- [x] `recalculateBalances` — deduplicates userIds before querying
- [x] `recalculateBalances` — correctly computes positive balance (deposits > withdrawals)
- [x] `recalculateBalances` — correctly computes negative balance (withdrawals > deposits)
- [x] `recalculateBalances` — returns `"0.00"` when user has no completed transactions
- [x] `recalculateBalances` — applies the completed/non-deleted filter (query-shape assertion; exact exclusion behavior against soft-deleted/non-completed rows is verified against a real DB in Phase 9)
- [x] `recalculateBalances` — handles multiple userIds in a single call

## 8c — Business Logic: `src/lib/queries.ts`

- [x] `fetchUsersAndCategories` — returns `{ users, categories }` shape
- [x] `fetchUsersAndCategories` — filters out soft-deleted users and categories (`where()` called)
- [x] `fetchUsersAndCategories` — orders users and categories ascending (`orderBy()` called)
- [x] `fetchUsersAndCategories` — returns empty arrays when tables are empty

## 8d — Utilities: `src/utils/date.ts`

- [x] Date formatting function — formats valid ISO date string to expected display format
- [x] Date formatting function — handles edge cases (midnight, end-of-month, leap-year day)
- [x] Date formatting function — handles invalid/undefined date input gracefully

## 8e — Utilities: `src/utils/nav.ts`

**Skipped.** `navClass(active)` is a static string-concatenation helper with no branching worth regression-testing — dropped per explicit direction to prioritize business logic and complex functions over plan-checklist completeness for trivial code. Not included in the coverage scope.

## 8f — API Route: `POST /api/transactions/group` (`src/pages/api/transactions/group/index.ts`)

Required body fields: `name`, `date`, `amount` (number), `paidByUserId`, `parties` (array). Optional: `remarks`, `categoryId`, `customAmounts`.

- [x] Returns `401` when no session exists
- [x] Returns `400` when required fields are missing (name, date, amount, paidByUserId, parties)
- [x] Returns `400` when `amount` is not a positive number
- [x] Returns `400` when `parties` is an empty array
- [x] Returns `400` when `paidByUserId` is not included in `parties`
- [x] Returns `400` when date string is not a valid date
- [x] Returns `400` when custom amounts do not sum to total amount
- [x] Returns `400` when a custom amount for any party is negative
- [x] Inserts 1 deposit + N withdrawals for N parties (equal split)
- [x] Inserts 1 deposit + N withdrawals for N parties (custom amounts)
- [x] Sets status `'completed'` when session user is admin
- [x] Sets status `'pending'` when session user is a regular user
- [x] Calls `recalculateBalances` after insert when status is `'completed'`
- [x] Does not call `recalculateBalances` when status is `'pending'`
- [x] All inserted transactions share the same `transactionGroupId`
- [x] Returns `201` with `{ id: groupId }` on success

## 8g — API Route: `POST /api/transactions/single` (`src/pages/api/transactions/single.ts`)

Any authenticated user (not admin-only) can create a single transaction. Required body fields: `name`, `date`, `amount` (number), `paidByUserId`, `type`, `status`.

- [x] Returns `401` when no session exists
- [x] Returns `400` when required fields are missing (name, date, amount, paidByUserId, type, status)
- [x] Returns `400` when `amount` is not a positive number
- [x] Returns `400` when `type` is not `'deposit'` or `'withdrawal'`
- [x] Returns `400` when `status` is not `'pending'`, `'completed'`, or `'cancelled'`
- [x] Returns `400` when date string is not a valid date
- [x] Inserts a single transaction record on valid input
- [x] Calls `recalculateBalances` only when `status` is `'completed'`
- [x] Does not call `recalculateBalances` when `status` is `'pending'` or `'cancelled'`
- [x] Returns `201` with `{ id }` on success

## 8h — API Route: `PATCH /api/transactions/group/[groupId]/status` (`src/pages/api/transactions/group/[groupId]/status.ts`)

Body field is `action: 'approve' | 'reject'` (not `status`).

- [x] Returns `401` when no session exists
- [x] Returns `403` when session user is not admin
- [x] Returns `400` when `action` is not `'approve'` or `'reject'`
- [x] Returns `404` when `groupId` does not exist (no non-deleted transactions found)
- [x] Returns `409` when the group has no pending transactions to update
- [x] Sets all group transactions to `'completed'` when `action` is `'approve'`
- [x] Sets all group transactions to `'cancelled'` when `action` is `'reject'`
- [x] Calls `recalculateBalances` for all affected users when approved
- [x] Does not call `recalculateBalances` when rejected
- [x] Returns `200` with `{ groupId, status }` on success

## 8i — API Route: `DELETE /api/transactions/group/[groupId]` (`src/pages/api/transactions/group/[groupId]/index.ts`)

- [x] Returns `401` when no session exists
- [x] Returns `403` when session user is not admin
- [x] Returns `404` when `groupId` does not exist
- [x] Sets `deletedAt` on all transactions in the group
- [x] Calls `recalculateBalances` when the deleted group was `'completed'`
- [x] Does not call `recalculateBalances` when the deleted group was `'pending'` or `'cancelled'`
- [x] Returns `200` on success

## 8j — API Route: `POST /api/transactions/import` (`src/pages/api/transactions/import.ts`)

- [x] Returns `401` when no session exists
- [x] Returns `403` when session user is not admin
- [x] Returns `415` when Content-Type is not `application/json`, `text/csv`, or `multipart/form-data`
- [x] Returns `400` when JSON body is not an array
- [x] Returns `400` when no rows are provided (empty file/array)
- [x] Returns `400` when the `file` field is missing from a `multipart/form-data` request
- [x] Returns `422` with per-row errors when CSV rows fail validation
- [x] Returns `422` with per-row errors when JSON rows fail validation
- [x] Rejects the entire import when any row has a validation error (no partial insert)
- [x] Bulk-inserts all rows inside a DB transaction on valid input
- [x] Calls `recalculateBalances` for all unique affected users after import
- [x] Returns `201` with count of imported transactions on success
- [x] (added) Accepts a valid `multipart/form-data` CSV upload end-to-end

**Bug found while testing, not fixed here:** `parseCsv` (duplicated in this file and in `src/components/ImportForm.vue`) uses `[^,]+` to capture unquoted fields, which matches one-or-more characters — so a genuinely empty field (e.g. `Groceries,,42.50,...`) produces no match at that position and silently shifts every following column left by one, instead of validating it as empty. Tests were written to avoid tripping this (using out-of-range/invalid values instead of blank fields) so they reflect real, intended behavior rather than the bug. Spun off as a separate follow-up task rather than fixed in this test-only phase.

## 8k — API Routes: Categories (`src/pages/api/categories/`)

- [x] `GET /api/categories` — returns paginated list, excludes soft-deleted
- [x] `GET /api/categories` — returns `401` when no session
- [x] `POST /api/categories` — returns `403` when not admin
- [x] `POST /api/categories` — returns `400` when `label` is missing
- [x] `POST /api/categories` — inserts and returns `201` on valid input
- [x] `PATCH /api/categories/[id]` — returns `403` when not admin
- [x] `PATCH /api/categories/[id]` — returns `404` when id does not exist
- [x] `PATCH /api/categories/[id]` — updates and returns `200` on valid input
- [x] `DELETE /api/categories/[id]` — returns `403` when not admin
- [x] `DELETE /api/categories/[id]` — returns `404` when id does not exist
- [x] `DELETE /api/categories/[id]` — sets `deletedAt` (soft-delete) and returns `200`

## 8l — API Routes: Users (`src/pages/api/users/`)

- [x] `GET /api/users` — returns `403` when not admin
- [x] `GET /api/users` — returns paginated list, excludes soft-deleted
- [x] `GET /api/users` — filters by role when `?role=admin` or `?role=user` is provided
- [x] `POST /api/users` — returns `403` when not admin
- [x] `POST /api/users` — returns `400` when `email` or `name` is missing
- [ ] ~~`POST /api/users` — returns `409` when email already exists~~ — not implemented in `src/pages/api/users/index.ts`: the handler inserts unconditionally with no pre-check, so a duplicate email currently 500s on the DB's unique constraint rather than returning a clean `409`. Left unchecked here since there's no `409` behavior to test; worth a small follow-up (pre-check + `409`) outside this phase.
- [x] `POST /api/users` — inserts and returns `201` on valid input
- [x] `PATCH /api/users/[id]` — returns `403` when not admin
- [x] `PATCH /api/users/[id]` — returns `404` when id does not exist
- [x] `PATCH /api/users/[id]` — updates and returns `200` on valid input
- [x] `DELETE /api/users/[id]` — returns `403` when not admin
- [x] `DELETE /api/users/[id]` — returns `400` when attempting to delete own account
- [x] `DELETE /api/users/[id]` — returns `404` when id does not exist
- [x] `DELETE /api/users/[id]` — sets `deletedAt` and returns `200`

## 8m — Middleware: `src/middleware.ts`

- [x] Allows unauthenticated access to `/` and `/login`
- [x] Redirects unauthenticated requests to `/dashboard` → `/login`
- [x] Redirects non-admin requests to `/users` → `/dashboard`
- [x] Redirects non-admin requests to `/transaction-categories` → `/dashboard`
- [x] Redirects non-admin requests to `/import-transactions` → `/dashboard`
- [x] Redirects non-admin requests to `/approve-transactions` → `/dashboard`
- [x] Injects `user` and `session` into `context.locals` for authenticated requests
- [x] Passes through authenticated requests to unprotected routes
- [x] (added) Demo mode blocks mutating `/api/*` requests with `403` regardless of auth state, but still allows the auth API and GET requests through

## 8n — Vue Components (Component Unit Tests)

Test depth is scaled to each component's actual script complexity rather than treated as a uniform checklist — heaviest coverage on components with real validation/state logic (`GroupTransactionForm`, `ImportForm`, `ApproveTransactions`, `LoginForm`), lighter coverage on components that are mostly thin CRUD wrappers around `DataTable` + `useServerTable` (`UserTable`, `CategoryTable`). `DataTable.vue` and `SignOutButton.vue` were never in scope (pure presentational / trivial) and are excluded from the coverage glob.

- [x] **`LoginForm.vue`** — renders email input and submit button; shows error on failed request; disables button while loading; (added) OTP step transitions, OTP failure, "use a different email" reset, demo-mode CTA
- [x] **`GroupTransactionForm.vue`** — renders all fields; enables/disables custom amount inputs based on toggle; validates that custom amounts sum to total before submit; submits correct payload to API (equal split and custom split); payer can't be removed from parties; shows API error
- [x] **`SingleTransactionForm.vue`** — renders all fields; submits correct payload to API; shows error on failed request; submit disabled until required fields filled
- [x] **`TransactionTable.vue`** — renders rows; applies greyed-out style to soft-deleted rows; displays status badges. *(Scope note: the component renders a flat list, not the "group summary + child rows" hierarchy the original plan text described — that hierarchy doesn't exist in the current implementation, so tests assert actual behavior instead.)*
- [x] **`UserTable.vue`** — renders user rows with name, email, role, balance; opens the create modal; hides the delete action on the current user's own row; delete triggers the DELETE API after confirmation. *(Edit-button click isn't separately asserted here — `UserFormModal`'s pre-population from a passed-in user is already covered directly in its own test file.)*
- [x] **`UserFormModal.vue`** — renders create form with empty fields; renders edit form pre-populated; emits `saved` event on success (POST for create, PATCH for edit); shows error on failed request; emits `close` on cancel
- [x] **`CategoryTable.vue`** — renders category rows; edit button opens a pre-filled modal; delete calls the API after confirmation and is skipped when confirmation is dismissed
- [x] **`CategoryFormModal.vue`** — renders create/edit form; emits `saved` event on success (POST for create, PATCH for edit); submit disabled until label is non-empty
- [x] **`ImportForm.vue`** — parses and previews CSV rows; parses and previews JSON rows; shows per-row validation errors; disables submit while errors exist; submits on valid file; shows a parse error for unsupported file types
- [x] **`ApproveTransactions.vue`** — renders pending groups; empty state; approve/reject API calls remove the group from the list on success; skips the API call when the confirm dialog is dismissed; shows an error and keeps the group listed on API failure

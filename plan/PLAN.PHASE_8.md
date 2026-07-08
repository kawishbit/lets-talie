# Phase 8 — Unit Testing

The testing strategy is **unit-first**: isolate and test each piece of business logic, each API route handler, and each utility in isolation. Use **Vitest** as the test runner (compatible with Bun and the Vite/Astro build pipeline). Database calls are mocked with `vi.mock`. Vue components are tested with **@vue/test-utils** + **@testing-library/vue**.

## 8a — Test Infrastructure Setup

- [ ] Install test dependencies: `vitest`, `@vitest/coverage-v8`, `@vue/test-utils`, `@testing-library/vue`, `jsdom`
- [ ] Add `vitest.config.ts` — configure environment (`jsdom`), path aliases (`@db`, `@lib`), coverage thresholds
- [ ] Add `test` script to `package.json`: `vitest run`
- [ ] Add `test:coverage` script: `vitest run --coverage`
- [ ] Add `test:watch` script: `vitest`
- [ ] Create `src/__tests__/` directory for unit tests
- [ ] Create `src/__tests__/setup.ts` — global test setup (mock env vars, db)

## 8b — Business Logic: `src/lib/balance.ts`

- [ ] `recalculateBalances` — skips update when `userIds` is empty
- [ ] `recalculateBalances` — deduplicates userIds before querying
- [ ] `recalculateBalances` — correctly computes positive balance (deposits > withdrawals)
- [ ] `recalculateBalances` — correctly computes negative balance (withdrawals > deposits)
- [ ] `recalculateBalances` — returns `"0.00"` when user has no completed transactions
- [ ] `recalculateBalances` — excludes soft-deleted transactions (`deletedAt IS NOT NULL`)
- [ ] `recalculateBalances` — excludes non-completed transactions (`status != 'completed'`)
- [ ] `recalculateBalances` — handles multiple userIds in a single call

## 8c — Business Logic: `src/lib/queries.ts`

- [ ] `fetchUsersAndCategories` — returns `{ users, categories }` shape
- [ ] `fetchUsersAndCategories` — filters out soft-deleted users
- [ ] `fetchUsersAndCategories` — filters out soft-deleted categories
- [ ] `fetchUsersAndCategories` — orders users by name ascending
- [ ] `fetchUsersAndCategories` — orders categories by label ascending
- [ ] `fetchUsersAndCategories` — returns empty arrays when tables are empty

## 8d — Utilities: `src/utils/date.ts`

- [ ] Date formatting function — formats valid ISO date string to expected display format
- [ ] Date formatting function — handles edge cases (midnight, end-of-month, leap-year day)
- [ ] Date formatting function — handles invalid/null date input gracefully

## 8e — Utilities: `src/utils/nav.ts`

`navClass(active: boolean)` accepts a pre-computed boolean and returns a class list array.

- [ ] `navClass(true)` — includes `bg-ink` and `text-canvas` in the returned array
- [ ] `navClass(false)` — includes `hover:bg-surface` and does **not** include `bg-ink` or `text-canvas`
- [ ] Both results include the shared base classes (`px-3`, `py-1.5`, `rounded-full`, `text-sm`, `transition-colors`)

## 8f — API Route: `POST /api/transactions/group` (`src/pages/api/transactions/group/index.ts`)

Required body fields: `name`, `date`, `amount` (number), `paidByUserId`, `parties` (array). Optional: `remarks`, `categoryId`, `customAmounts`.

- [ ] Returns `401` when no session exists
- [ ] Returns `400` when required fields are missing (name, date, amount, paidByUserId, parties)
- [ ] Returns `400` when `amount` is not a positive number
- [ ] Returns `400` when `parties` is an empty array
- [ ] Returns `400` when `paidByUserId` is not included in `parties`
- [ ] Returns `400` when date string is not a valid date
- [ ] Returns `400` when custom amounts do not sum to total amount
- [ ] Returns `400` when a custom amount for any party is negative
- [ ] Inserts 1 deposit + N withdrawals for N parties (equal split)
- [ ] Inserts 1 deposit + N withdrawals for N parties (custom amounts)
- [ ] Sets status `'completed'` when session user is admin
- [ ] Sets status `'pending'` when session user is a regular user
- [ ] Calls `recalculateBalances` after insert when status is `'completed'`
- [ ] Does not call `recalculateBalances` when status is `'pending'`
- [ ] All inserted transactions share the same `transactionGroupId`
- [ ] Returns `201` with `{ id: groupId }` on success

## 8g — API Route: `POST /api/transactions/single` (`src/pages/api/transactions/single.ts`)

Any authenticated user (not admin-only) can create a single transaction. Required body fields: `name`, `date`, `amount` (number), `paidByUserId`, `type`, `status`.

- [ ] Returns `401` when no session exists
- [ ] Returns `400` when required fields are missing (name, date, amount, paidByUserId, type, status)
- [ ] Returns `400` when `amount` is not a positive number
- [ ] Returns `400` when `type` is not `'deposit'` or `'withdrawal'`
- [ ] Returns `400` when `status` is not `'pending'`, `'completed'`, or `'cancelled'`
- [ ] Returns `400` when date string is not a valid date
- [ ] Inserts a single transaction record on valid input
- [ ] Calls `recalculateBalances` only when `status` is `'completed'`
- [ ] Does not call `recalculateBalances` when `status` is `'pending'` or `'cancelled'`
- [ ] Returns `201` with `{ id }` on success

## 8h — API Route: `PATCH /api/transactions/group/[groupId]/status` (`src/pages/api/transactions/group/[groupId]/status.ts`)

Body field is `action: 'approve' | 'reject'` (not `status`).

- [ ] Returns `401` when no session exists
- [ ] Returns `403` when session user is not admin
- [ ] Returns `400` when `action` is not `'approve'` or `'reject'`
- [ ] Returns `404` when `groupId` does not exist (no non-deleted transactions found)
- [ ] Returns `409` when the group has no pending transactions to update
- [ ] Sets all group transactions to `'completed'` when `action` is `'approve'`
- [ ] Sets all group transactions to `'cancelled'` when `action` is `'reject'`
- [ ] Calls `recalculateBalances` for all affected users when approved
- [ ] Does not call `recalculateBalances` when rejected
- [ ] Returns `200` with `{ groupId, status }` on success

## 8i — API Route: `DELETE /api/transactions/group/[groupId]` (`src/pages/api/transactions/group/[groupId]/index.ts`)

- [ ] Returns `401` when no session exists
- [ ] Returns `403` when session user is not admin
- [ ] Returns `404` when `groupId` does not exist
- [ ] Sets `deletedAt` on all transactions in the group
- [ ] Calls `recalculateBalances` when the deleted group was `'completed'`
- [ ] Does not call `recalculateBalances` when the deleted group was `'pending'` or `'cancelled'`
- [ ] Returns `200` on success

## 8j — API Route: `POST /api/transactions/import` (`src/pages/api/transactions/import.ts`)

- [ ] Returns `401` when no session exists
- [ ] Returns `403` when session user is not admin
- [ ] Returns `415` when Content-Type is not `application/json`, `text/csv`, or `multipart/form-data`
- [ ] Returns `400` when JSON body is not an array
- [ ] Returns `400` when no rows are provided (empty file/array)
- [ ] Returns `400` when the `file` field is missing from a `multipart/form-data` request
- [ ] Returns `422` with per-row errors when CSV rows fail validation
- [ ] Returns `422` with per-row errors when JSON rows fail validation
- [ ] Rejects the entire import when any row has a validation error (no partial insert)
- [ ] Bulk-inserts all rows inside a DB transaction on valid input
- [ ] Calls `recalculateBalances` for all unique affected users after import
- [ ] Returns `201` with count of imported transactions on success

## 8k — API Routes: Categories (`src/pages/api/categories/`)

- [ ] `GET /api/categories` — returns paginated list, excludes soft-deleted
- [ ] `GET /api/categories` — returns `401` when no session
- [ ] `POST /api/categories` — returns `403` when not admin
- [ ] `POST /api/categories` — returns `400` when `label` is missing
- [ ] `POST /api/categories` — inserts and returns `201` on valid input
- [ ] `PATCH /api/categories/[id]` — returns `403` when not admin
- [ ] `PATCH /api/categories/[id]` — returns `404` when id does not exist
- [ ] `PATCH /api/categories/[id]` — updates and returns `200` on valid input
- [ ] `DELETE /api/categories/[id]` — returns `403` when not admin
- [ ] `DELETE /api/categories/[id]` — returns `404` when id does not exist
- [ ] `DELETE /api/categories/[id]` — sets `deletedAt` (soft-delete) and returns `200`

## 8l — API Routes: Users (`src/pages/api/users/`)

- [ ] `GET /api/users` — returns `403` when not admin
- [ ] `GET /api/users` — returns paginated list, excludes soft-deleted
- [ ] `GET /api/users` — filters by role when `?role=admin` or `?role=user` is provided
- [ ] `POST /api/users` — returns `403` when not admin
- [ ] `POST /api/users` — returns `400` when `email` or `name` is missing
- [ ] `POST /api/users` — returns `409` when email already exists
- [ ] `POST /api/users` — inserts and returns `201` on valid input
- [ ] `PATCH /api/users/[id]` — returns `403` when not admin
- [ ] `PATCH /api/users/[id]` — returns `404` when id does not exist
- [ ] `PATCH /api/users/[id]` — updates and returns `200` on valid input
- [ ] `DELETE /api/users/[id]` — returns `403` when not admin
- [ ] `DELETE /api/users/[id]` — returns `400` when attempting to delete own account
- [ ] `DELETE /api/users/[id]` — returns `404` when id does not exist
- [ ] `DELETE /api/users/[id]` — sets `deletedAt` and returns `200`

## 8m — Middleware: `src/middleware.ts`

- [ ] Allows unauthenticated access to `/` and `/login`
- [ ] Redirects unauthenticated requests to `/dashboard` → `/login`
- [ ] Redirects non-admin requests to `/users` → `/dashboard`
- [ ] Redirects non-admin requests to `/transaction-categories` → `/dashboard`
- [ ] Redirects non-admin requests to `/import-transactions` → `/dashboard`
- [ ] Redirects non-admin requests to `/approve-transactions` → `/dashboard`
- [ ] Injects `user` and `session` into `context.locals` for authenticated requests
- [ ] Passes through authenticated requests to unprotected routes

## 8n — Vue Components (Component Unit Tests)

- [ ] **`LoginForm.vue`** — renders email input and submit button; shows error on failed request; disables button while loading
- [ ] **`GroupTransactionForm.vue`** — renders all fields; enables/disables custom amount inputs based on toggle; validates that custom amounts sum to total before submit; submits correct payload to API
- [ ] **`SingleTransactionForm.vue`** — renders all fields; submits correct payload to API; shows error on failed request
- [ ] **`TransactionTable.vue`** — renders group summary rows and child rows; applies greyed-out style to soft-deleted rows; displays correct status badges
- [ ] **`UserTable.vue`** — renders user rows with name, email, role, balance; triggers edit/delete events correctly
- [ ] **`UserFormModal.vue`** — renders create form with empty fields; renders edit form pre-populated; emits `saved` event on success; shows error on failed request
- [ ] **`CategoryTable.vue`** — renders category rows; triggers edit/delete events
- [ ] **`CategoryFormModal.vue`** — renders create/edit form; emits `saved` event on success
- [ ] **`ImportForm.vue`** — parses and previews CSV rows; parses and previews JSON rows; shows per-row validation errors; disables submit while errors exist; submits on valid file
- [ ] **`ApproveTransactions.vue`** — renders pending groups; triggers approve/reject API call on button click; removes group from list on success

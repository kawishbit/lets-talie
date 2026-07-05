# lets-talie — Plan

## Instructions
- Respect DESIGN.md 
- Implement responsive design (mobile-first)

## Todo List

### Phase 1 — Project Foundation

- [x] Astro project created
- [x] PWA integration (`@vite-pwa/astro`)
- [x] Better Auth installed with Drizzle adapter and magic link plugin
- [x] Drizzle ORM configured for PostgreSQL (Bun SQL driver)
- [x] Auth middleware (session injection into `context.locals`)
- [x] Auth API catch-all route (`src/pages/api/auth/[...all].ts`)
- [x] Install Vue integration (`@astrojs/vue`, `vue`)
- [x] Install Tailwind CSS (`tailwindcss`, `@tailwindcss/vite`)
- [x] Install Resend (`resend`)
- [x] Add `output: 'server'` to `astro.config.ts` (required for SSR / Better Auth)
- [x] Configure Vue and Tailwind in `astro.config.ts`
- [x] Create `src/styles/global.css` and import in `Layout.astro`
- [x] Remove unused `pg` / `Pool` import from `auth.ts`

---

### Phase 2 — Database Schema (`src/db/schema.ts`)

- [x] Generate Better Auth tables via Drizzle migration. Using `bunx drizzle-kit generate` and `bunx drizzle-kit migrate`, create the following tables:
  - [x] `user` table — Better Auth core + additionalFields: `role` (text, default `'user'`) + `accountBalance` (numeric 10,2, default `0.00`) (make sure to include the `additionalFields` in the Drizzle schema code)
  - [x] `session` table — Better Auth core
  - [x] `account` table — Better Auth core
  - [x] `verification` table — Better Auth core
- [x] `transactionCategories` table
- [x] `transactions` table
- [x] Run `bunx drizzle-kit generate`

---

### Phase 3 — Authentication

- [x] Implement `sendMagicLink` callback using Resend
- [x] Add `RESEND_API_KEY` to `.env.example`
- [x] Update `env.d.ts` — type `App.Locals` with `user` (including `role`, `accountBalance`) and `session`
- [x] Update middleware:
  - Public routes: `/`, `/login`
  - Protected routes: `/dashboard` and all sub-paths
  - Admin-only routes: `/users`, `/transaction-categories`, `/import-transactions`, `/approve-transactions`
  - Redirect unauthenticated → `/login`
  - Redirect non-admin hitting admin route → `/dashboard`

---

### Phase 4 — Core Business Logic (API Routes)

- [x] `recalculateBalances(userIds: string[])` helper — recomputes `accountBalance` from completed, non-deleted transactions and updates the `user` table
- [x] `POST /api/transactions/group` — create group transaction
  - Validate session and input
  - Generate `transactionGroupId`
  - Split amount equally or by custom amounts (validate custom amounts sum to total)
  - Insert 1 deposit (paidBy, full amount) + N withdrawals (one per party including paidBy)
  - Status: `'completed'` for admin, `'pending'` for regular user
  - If completed, call `recalculateBalances`
- [x] `POST /api/transactions/single` — create single transaction (admin only)
- [x] `PATCH /api/transactions/group/[groupId]/status` — approve or reject group (admin only)
  - Approve → set all to `'completed'`, call `recalculateBalances`
  - Reject → set all to `'cancelled'`
- [x] `DELETE /api/transactions/group/[groupId]` — soft-delete group (admin only)
  - If group was `'completed'`, reverse balance changes via `recalculateBalances`
- [x] `GET /api/categories` — list categories (paginated, server-side)
- [x] `POST /api/categories` — create category (admin only)
- [x] `PATCH /api/categories/[id]` — update category (admin only)
- [x] `DELETE /api/categories/[id]` — soft-delete category (admin only)
- [x] `GET /api/users` — list users (paginated, server-side, admin only)
- [x] `POST /api/users` — create user (admin only)
- [x] `PATCH /api/users/[id]` — update user (admin only)
- [x] `DELETE /api/users/[id]` — soft-delete user (admin only)
- [x] `POST /api/transactions/import` — bulk import (admin only)
  - Accept CSV or JSON; parse against single transaction schema
  - Return per-row validation errors; reject partial imports
  - Bulk-insert in a DB transaction
  - Call `recalculateBalances` for all affected users after import

---

### Phase 5 — Pages & Components

#### Layout & Shared

- [x] `src/layouts/Layout.astro` — nav bar, global CSS, conditional admin links
- [x] Nav bar with links: Home (`/dashboard`), Transactions (`/transactions`), and admin-only: Users, Categories, Import, Approve
- [x] Sign-out button in nav

#### Landing & Auth

- [x] `/` — Landing page: explain what lets-talie is, links to sign in
- [x] `/login` — Magic link sign-in form (Vue component: `LoginForm.vue`)

#### Dashboard — `/dashboard`

- [x] Server-side: fetch session and `accountBalance`
- [x] Display balance (positive = group owes you, negative = you owe)
- [x] "Add Group Transaction" tab/section — `GroupTransactionForm.vue`
  - Fields: name, date, remarks, amount, paid by (dropdown), parties (multi-select), category (dropdown)
  - Per-party custom amount toggle; validation that custom amounts sum to total
  - Submits to `POST /api/transactions/group`
- [x] "Add Single Transaction" tab/section (admin only) — `SingleTransactionForm.vue`
  - Fields: name, date, remarks, amount, paid by, type, status, category
  - Submits to `POST /api/transactions/single`



#### Transactions — `/transactions`

- [ ] Server-side fetch with server-side pagination
- [ ] Regular user sees own transactions; admin sees all
- [ ] Soft-deleted transactions displayed greyed out
- [ ] Filters: date range, category, status, type
- [ ] Sorting: date, amount
- [ ] `TransactionTable.vue` — renders grouped rows with a group summary row

#### Users — `/users` (admin only)

- [ ] Server-side fetch, server-side pagination
- [ ] `UserTable.vue` — name, email, role, accountBalance, createdAt
- [ ] `UserFormModal.vue` — create / edit user
- [ ] Filter by role; delete button (soft-delete)

#### Transaction Categories — `/transaction-categories` (admin only)

- [ ] Server-side fetch, server-side pagination
- [ ] `CategoryTable.vue` — label, remarks, createdAt
- [ ] `CategoryFormModal.vue` — create / edit category

#### Import Transactions — `/import-transactions` (admin only)

- [ ] `ImportForm.vue`
  - File input: `.csv` or `.json`
  - Preview parsed rows in a table
  - Per-row validation errors shown inline
  - Submit disabled while any errors exist
  - Submits to `POST /api/transactions/import`

#### Approve Transactions — `/approve-transactions` (admin only)

- [ ] Server-side fetch of pending transaction groups, server-side pagination
- [ ] List rows: group name, total amount, paid by, parties, date
- [ ] Approve / Reject buttons per group → `PATCH /api/transactions/group/[groupId]/status`

---

### Phase 6 — PWA & Deployment

- [ ] Add `pwa-192x192.png` and `pwa-512x512.png` to `public/`
- [ ] Update PWA manifest description in `astro.config.ts`
- [ ] Install `@astrojs/vercel` adapter
- [ ] Configure Vercel adapter in `astro.config.ts`
- [ ] Document required Vercel environment variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`

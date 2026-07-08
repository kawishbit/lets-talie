# Phase 5 — Pages & Components

## Layout & Shared

- [x] `src/layouts/Layout.astro` — nav bar, global CSS, conditional admin links
- [x] Nav bar with links: Home (`/dashboard`), Transactions (`/transactions`), and admin-only: Users, Categories, Import, Approve
- [x] Sign-out button in nav

## Landing & Auth

- [x] `/` — Landing page: explain what lets-talie is, links to sign in
- [x] `/login` — Magic link sign-in form (Vue component: `LoginForm.vue`)

## Dashboard — `/dashboard`

- [x] Server-side: fetch session and `accountBalance`
- [x] Display balance (positive = group owes you, negative = you owe)
- [x] "Add Group Transaction" tab/section — `GroupTransactionForm.vue`
  - Fields: name, date, remarks, amount, paid by (dropdown), parties (multi-select), category (dropdown)
  - Per-party custom amount toggle; validation that custom amounts sum to total
  - Submits to `POST /api/transactions/group`
- [x] "Add Single Transaction" tab/section — `SingleTransactionForm.vue` (available to all users)
  - Fields: name, date, remarks, amount, paid by, type, status, category
  - Submits to `POST /api/transactions/single`

## Transactions — `/transactions`

- [x] Server-side fetch with server-side pagination
- [x] Regular user sees own transactions; admin sees all
- [x] Soft-deleted transactions displayed greyed out
- [x] Filters: date range, category, status, type
- [x] Sorting: date, amount
- [x] `TransactionTable.vue` — renders grouped rows with a group summary row

## Users — `/users` (admin only)

- [x] Server-side fetch, server-side pagination
- [x] `UserTable.vue` — name, email, role, accountBalance, createdAt
- [x] `UserFormModal.vue` — create / edit user
- [x] Filter by role; delete button (soft-delete)

## Transaction Categories — `/transaction-categories` (admin only)

- [x] Server-side fetch, server-side pagination
- [x] `CategoryTable.vue` — label, remarks, createdAt
- [x] `CategoryFormModal.vue` — create / edit category

## Import Transactions — `/import-transactions` (admin only)

- [x] `ImportForm.vue`
  - Accepts `.csv` or `.json`
  - Optional fields: `transactionGroupId` (group key to link rows) and `createdAt` (ISO 8601 date override)
  - File input: `.csv` or `.json`
  - Preview parsed rows in a table
  - Per-row validation errors shown inline
  - Submit disabled while any errors exist
  - Submits to `POST /api/transactions/import`

## Approve Transactions — `/approve-transactions` (admin only)

- [x] Server-side fetch of pending transaction groups, server-side pagination
- [x] List rows: group name, total amount, paid by, parties, date
- [x] Approve / Reject buttons per group → `PATCH /api/transactions/group/[groupId]/status`

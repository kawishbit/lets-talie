# Phase 2 — Database Schema (`src/db/schema.ts`)

- [x] Generate Better Auth tables via Drizzle migration. Using `bunx drizzle-kit generate` and `bunx drizzle-kit migrate`, create the following tables:
  - [x] `user` table — Better Auth core + additionalFields: `role` (text, default `'user'`) + `accountBalance` (numeric 10,2, default `0.00`) (make sure to include the `additionalFields` in the Drizzle schema code)
  - [x] `session` table — Better Auth core
  - [x] `account` table — Better Auth core
  - [x] `verification` table — Better Auth core
- [x] `transactionCategories` table
- [x] `transactions` table
- [x] Run `bunx drizzle-kit generate`

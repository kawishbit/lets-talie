# lets-talie

PWA for splitting group expenses between friends and family, with automatic balance calculation. Negative balance = you owe the group; positive = the group owes you.

## Rules

- **Confirm before adding dependencies.** Ask before introducing any new package/library — avoids bloat, keeps the project maintainable.
- **Bun for tooling, Node for the runtime.** Use `bun`/`bunx` for installing deps and running scripts (never `npm`/`npx`). But the app *runs* on Node — the server is started with `node ./dist/server/entry.mjs` (see the `start` script and Dockerfile), and the DB layer must stay Node-compatible: `src/db/database.ts` uses `drizzle-orm/postgres-js` + `process.env` (never `drizzle-orm/bun-sql` or the `Bun.env`/`Bun.*` globals, which break on Vercel's Node runtime).
- **No AI attribution in commits.** Do not add `Co-Authored-By: Claude` or similar trailers to commit messages.
- **Respect `.gitignore`.** Never stage or commit ignored files (`.env`, `dist/`, `.vercel/`, etc).
- **Ask when unclear.** Confirm requirements and raise questions before implementing rather than guessing.
- **UI work:** read [DESIGN.md](DESIGN.md) first and follow it, for any component/page/layout change.
- **Dev server:** run in background — `astro dev --background`, managed via `astro dev stop|status|logs`.

## Scripts

| `bun run <script>` | Purpose |
| --- | --- |
| `dev` | Dev server (port 30001) |
| `build` | Production build — Node adapter by default, `ADAPTER=vercel` for the Vercel build |
| `preview` | Preview a production build locally |
| `migrate` | Apply Drizzle migrations |
| `start` | Run a built server under Node — `node ./dist/server/entry.mjs` (`build` first) |
| `seed:demo` | Seed the demo account + sample data (`DEMO_USER_EMAIL` required) |
| `format` | Format with Biome |
| `lint` | Lint with Biome |
| `check` | Lint + format check (Biome) |
| `check:fix` | Lint + format, applying fixes |
| `astro` | Run arbitrary Astro CLI commands |

## Tech stack

Astro (Vue islands) · Tailwind CSS · Drizzle ORM + Postgres (postgres-js driver) · Better Auth · Node runtime · Bun (package manager / task runner) · TypeScript · PWA (service worker, offline support)

## Database

Better Auth owns `user`, `session`, `account`, `verification`. `user` is extended with `role`, `accountBalance`, `banned`, `banReason`, `banExpires`, `deletedAt`. App tables: `transaction_categories`, `transactions`. Exact columns live in `src/db/schema.ts` — read that instead of relying on a description here.

## Features

**Admin:** full CRUD on transactions, users, and categories; approve/reject transaction groups (individually or in bulk); import transactions from CSV/JSON.
**Everyone:** view balance; add group or single transactions (auto-approved for admins, pending approval for regular users); view transaction history (own for users, all for admins).

### Transaction group logic

A group transaction splits one payment across multiple people. Example: A, B, and C share a $30 Uber, A pays.

1. A submits: name, amount ($30), paid by (A), parties ([A, B, C]).
2. Backend creates 4 rows sharing one `transactionGroupId`:
   - A deposits $30 (`type=deposit`)
   - A, B, C each withdraw $10 (`type=withdrawal`)
3. Result: A's balance +$20, B's balance −$10, C's balance −$10.

Custom per-party amounts are supported; if omitted, the total splits evenly. The group form (name, date, remarks, amount, paid by, parties, category, optional custom amounts) is distinct from the single-transaction form (name, date, remarks, amount, paid by, type, status, category).

### Balance rules

- Balance = sum(deposits) − sum(withdrawals), `completed` status only.
- Stored on `user.accountBalance` and recalculated (not derived live) after every transaction change — avoids scanning full history on every read.
- Deleting a grouped transaction deletes the whole group and recalculates balances for every party involved.

## Pages

| Path | Access | Purpose |
| --- | --- | --- |
| `/` | All | Balance + add group/single transaction forms |
| `/transactions` | All | Transaction history, with filters and sorting |
| `/users` | Admin | User list + CRUD |
| `/transaction-categories` | Admin | Category list + CRUD |
| `/import-transactions` | Admin | CSV/JSON import with validation; recalculates balances after import |
| `/approve-transactions` | Admin | Pending transaction group approvals |

## Astro docs

https://docs.astro.build — [routing](https://docs.astro.build/en/guides/routing/), [components](https://docs.astro.build/en/basics/astro-components/), [framework components](https://docs.astro.build/en/guides/framework-components/), [content collections](https://docs.astro.build/en/guides/content-collections/), [styling](https://docs.astro.build/en/guides/styling/), [i18n](https://docs.astro.build/en/guides/internationalization/).

<!-- PROJECT BANNER -->
<p align="center">
  <img src="logo/banner.png" alt="lets-talie — split shared expenses between friends and family" width="100%" />
</p>

<h1 align="center">lets-talie</h1>

<p align="center">
  <strong>Shared-expense tracker</strong> — log who paid for what, and lets-talie works out who owes whom.<br />
  Installable PWA · self-hostable · automatic balance calculation.
</p>

<p align="center">
  <a href="#getting-started">Getting started</a>
  ·
  <a href="#usage">Usage</a>
  ·
  <a href="#self-hosting">Self-hosting</a>
  ·
  <a href="#environment-variables">Environment variables</a>
  ·
  <a href="#license">License</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-2f6fed?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-0a0a0a?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D22-black?style=flat-square" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-1f1d3d?style=flat-square" />
  <img alt="Stack" src="https://img.shields.io/badge/Astro%20%2B%20Vue%20%2B%20Tailwind-f7f7f5?style=flat-square&labelColor=0a0a0a" />
</p>

<p align="center">
  <strong>Live demo:</strong> <a href="https://lets-talie-demo.kawishbit.com">lets-talie-demo.kawishbit.com</a>
</p>

<br />

## About

**lets-talie** is a self-hostable PWA for tracking shared expenses between friends and family. Create a group, log who paid for what, and lets-talie keeps a running balance for everyone automatically.

A **negative** balance means you owe the group; a **positive** balance means the group owes you. Balances are recalculated after every transaction change rather than derived on read, so history stays fast to load.

### Features

- **Group transactions** — split one payment across multiple people, evenly or with custom per-party amounts
- **Single transactions** — record an individual deposit or withdrawal
- **Automatic balances** — `sum(deposits) − sum(withdrawals)` over completed transactions, stored per user
- **Approval workflow** — admin transactions auto-approve; regular users' transactions wait for approval
- **Admin CRUD** — full management of transactions, users, and categories
- **Bulk approvals** — approve or reject pending transaction groups individually or in bulk
- **CSV / JSON import** — validated bulk import that recalculates balances afterward
- **Passwordless auth** — email OTP / magic link login via Better Auth
- **Installable PWA** — service worker, offline shell, installable to home screen

### Built with

| Layer | Choice |
|-------|--------|
| App shell | [Astro](https://astro.build) + [Vue](https://vuejs.org) islands |
| Styles | [Tailwind CSS](https://tailwindcss.com) · UI conventions in [DESIGN.md](DESIGN.md) |
| Language | TypeScript |
| Database | [Drizzle ORM](https://orm.drizzle.team/) over Postgres (`postgres-js` driver) |
| Auth | [Better Auth](https://www.better-auth.com/) (passwordless email OTP / magic link) |
| Runtime | [Node](https://nodejs.org) ≥ 22 |
| Tooling | [Bun](https://bun.sh) (package manager · task runner) |
| PWA | service worker (offline shell, installable) |
| Deploy | Docker Compose · bare-metal Node · Vercel |

<p align="right">(<a href="#lets-talie">back to top</a>)</p>

## Getting started

### Prerequisites

- [Bun](https://bun.sh) (package manager / task runner)
- [Node](https://nodejs.org) 22 or newer (app runtime)
- A Postgres database
- SMTP credentials for passwordless login emails

### Installation

```sh
bun install
cp .env.example .env   # fill in BETTER_AUTH_SECRET, DATABASE_URL, SMTP_*
bun run migrate
astro dev --background  # or: bun run dev
```

The dev server runs on port **30001**.

### Production-like local preview

```sh
bun run build
bun run migrate
bun run start          # node ./dist/server/entry.mjs
```

<p align="right">(<a href="#lets-talie">back to top</a>)</p>

## Usage

### Typical flow

1. Sign in with a magic link / OTP sent to your email.
2. On the home page, view your balance and add a **group** or **single** transaction.
3. A group transaction splits one payment across parties — e.g. A, B, and C share a $30 Uber that A paid: A's balance goes +$20, B and C each −$10.
4. Regular users' transactions land in the approval queue; admins' are auto-approved.
5. Browse history under **Transactions**, with filters and sorting.

### Routes

| Path | Access | Page |
| --- | --- | --- |
| `/` | All | Balance + add group/single transaction forms |
| `/transactions` | All | Transaction history, with filters and sorting |
| `/users` | Admin | User list + CRUD |
| `/transaction-categories` | Admin | Category list + CRUD |
| `/import-transactions` | Admin | CSV/JSON import with validation |
| `/approve-transactions` | Admin | Pending transaction group approvals |

### Scripts

| Command | Action |
| --- | --- |
| `bun run dev` | Start the dev server (port 30001) |
| `bun run build` | Production build (Node adapter by default, `ADAPTER=vercel` for Vercel) |
| `bun run preview` | Preview a production build locally |
| `bun run migrate` | Apply Drizzle migrations |
| `bun run start` | Run a built server under Node (`bun run build` first) |
| `bun run seed:demo` | Seed the demo account + sample data (`DEMO_USER_EMAIL` required) |
| `bun run check` | Lint + format check (Biome) |
| `bun run check:fix` | Lint + format, applying fixes |
| `bun run test` | Run the test suite (Vitest) |

<p align="right">(<a href="#lets-talie">back to top</a>)</p>

## Self-hosting

The same codebase ships three ways. All three read configuration from environment variables — see the [reference table](#environment-variables) below.

### Docker Compose (recommended)

```sh
git clone <repo-url> && cd lets-talie
cp .env.example .env   # fill in BETTER_AUTH_SECRET, BETTER_AUTH_URL, SMTP_*
docker compose up -d
```

This starts Postgres and the app together, runs migrations on boot, and serves on `http://localhost:30001` (override with `APP_PORT` in `.env` if that port is taken).

### Bare-metal / clone & run

```sh
git clone <repo-url> && cd lets-talie
bun install
# provision Postgres yourself and set DATABASE_URL in .env
cp .env.example .env
bun run build
bun run migrate
bun run start
```

The app binds to `localhost` by default here, which is correct if you're putting a reverse proxy in front of it. Set `HOST=0.0.0.0` if you need it reachable directly.

### Vercel

Bring any external Postgres (Supabase, Neon, Vercel Postgres, etc.) — Vercel doesn't run a database for you.

1. Import the repo into a new Vercel project.
2. Select the Vercel adapter at build time, either way works:
   - Set `ADAPTER=vercel` as a Vercel project environment variable (simplest — Vercel's default Build Command already runs `astro build`), or
   - Override the project's Build Command to `ADAPTER=vercel bun run build`.

   Install Command (`bun install`) and Output Directory are auto-detected once `@astrojs/vercel` is installed; no `vercel.json` is needed.
3. Point `DATABASE_URL` at your Postgres provider (e.g. a Supabase connection string).
4. Set the auth vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your Vercel domain), and the `SMTP_*` vars for passwordless login emails.
5. Run migrations against that database once, before first traffic: `DATABASE_URL=<remote> bun run migrate` (run locally, or as a one-off Vercel deploy hook).

<p align="right">(<a href="#lets-talie">back to top</a>)</p>

## Environment variables

| Variable | Where | Description |
| --- | --- | --- |
| `ADAPTER` | Build-time | `vercel` for the Vercel build; unset for the Node/Docker/bare-metal build. |
| `BETTER_AUTH_SECRET` | All | Auth signing secret. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | All | Public URL the app is served at (no trailing slash). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | All | Outbound mail for passwordless login codes/magic links. |
| `PUBLIC_CURRENCY_CODE` | All | ISO 4217 code used for formatting amounts (e.g. `USD`). |
| `DATABASE_URL` | All except Docker Compose | Postgres connection string. Docker Compose sets this automatically for the `db` service. |
| `APP_PORT` / `DB_PORT` | Docker Compose only | Host-side port overrides, in case 30001 / 5433 are already taken locally. |

See [.env.example](.env.example) for a copy-pasteable template with defaults and comments.

<p align="right">(<a href="#lets-talie">back to top</a>)</p>

## Brand assets

Logo and banner artwork live in [`logo/`](logo).

| Asset | File |
| --- | --- |
| Banner | [`logo/banner.png`](logo/banner.png) |
| Logo (raster) | [`logo/logo.png`](logo/logo.png) |
| Logo (vector) | [`logo/logo.svg`](logo/logo.svg) |
| App / PWA icons | [`public/`](public) (`favicon.*`, `pwa-*.png`, `apple-touch-icon.png`) |

## License

Released under the [MIT License](LICENSE).

## Acknowledgments

- [Astro](https://astro.build) and [Vue](https://vuejs.org) for the app shell and interactive islands
- [Tailwind CSS](https://tailwindcss.com) for styling
- [Drizzle ORM](https://orm.drizzle.team/) for the type-safe Postgres layer
- [Better Auth](https://www.better-auth.com/) for passwordless authentication
- [Bun](https://bun.sh) for package management and task running

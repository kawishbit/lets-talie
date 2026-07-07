# Phase 3 — Authentication

- [x] Implement `sendMagicLink` callback using Resend
- [x] Add `RESEND_API_KEY` to `.env.example`
- [x] Update `env.d.ts` — type `App.Locals` with `user` (including `role`, `accountBalance`) and `session`
- [x] Update middleware:
  - Public routes: `/`, `/login`
  - Protected routes: `/dashboard` and all sub-paths
  - Admin-only routes: `/users`, `/transaction-categories`, `/import-transactions`, `/approve-transactions`
  - Redirect unauthenticated → `/login`
  - Redirect non-admin hitting admin route → `/dashboard`

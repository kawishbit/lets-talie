# Phase 6 — PWA, Self-Hosting & Deployment

## PWA Assets & Manifest

- [x] Add `pwa-192x192.png` and `pwa-512x512.png` to `public/`
- [x] Update PWA manifest name, short_name, and description in `astro.config.ts`

## Email — Replace Resend with Nodemailer

- [x] Remove `resend` package, install `nodemailer` and `@types/nodemailer`
- [x] Create SMTP transport in `src/lib/mailer.ts` using env vars:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `SMTP_SECURE` — set `true` for port 465 (SSL), `false` for port 587 (STARTTLS)
- [x] Remove `RESEND_API_KEY` from `src/env.d.ts`; add the SMTP vars above

## Auth — Replace magicLink plugin with passwordlessBundle

- [x] In `src/lib/auth.ts`:
  - Remove `magicLink` import from `better-auth/plugins` and `Resend` usage
  - Import `passwordlessBundle` from `./passwordless`
  - Wire `sendEmail` callback to use the nodemailer transport from `src/lib/mailer.ts`
- [x] In `src/lib/auth-client.ts`:
  - Remove `magicLinkClient` import
  - Import `passwordlessBundleClient` from `./passwordless` and add to `createAuthClient`
- [x] Update `src/env.d.ts` — add SMTP env vars to `ImportMetaEnv`
- [x] Update `LoginForm.vue`:
  - Change `authClient.signIn.magicLink(...)` call to `authClient.passwordlessBundle.request(...)`
  - Add an OTP input field that appears after the email is submitted
  - Call `authClient.passwordlessBundle.verifyOtp({ email, otp })` on OTP submit

## Docker & Self-Hosting

- [x] Create `Dockerfile`:
  - Use official `oven/bun` base image
  - Multi-stage: build stage (`bunx --bun astro build`), then slim runtime stage
  - Entrypoint runs `bun run drizzle-kit migrate` then starts the server
  - **Superseded (Node migration):** build stage stays on `oven/bun`, but the **runtime** stage is now `node:22-slim` and the entrypoint runs `./node_modules/.bin/drizzle-kit migrate && node --env-file-if-exists=.env dist/server/entry.mjs` — the app runs on Node, not Bun.
- [x] Create `docker-compose.yml`:
  - `db` service: `postgres:16-alpine`, volume for persistence, internal network
  - `app` service: built from local Dockerfile (or GHCR image), depends on `db`
  - `DATABASE_URL` wired automatically to the `db` service (no user input needed)
- [x] Create `.env.example` with all required variables

## Environment Variables Reference

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Auto (Docker) / Manual | Set automatically in docker-compose; set manually otherwise |
| `BETTER_AUTH_SECRET` | Yes | Random 32+ char secret |
| `BETTER_AUTH_URL` | Yes | Public URL of the app |
| `SMTP_HOST` | Yes | e.g. `smtp.mailgun.org` |
| `SMTP_PORT` | Yes | `587` (STARTTLS) or `465` (SSL) |
| `SMTP_SECURE` | Yes | `false` for 587, `true` for 465 |
| `SMTP_USER` | Yes | SMTP username |
| `SMTP_PASS` | Yes | SMTP password |
| `SMTP_FROM` | Yes | Sender address |



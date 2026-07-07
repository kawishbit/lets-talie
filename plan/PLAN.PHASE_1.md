# Phase 1 — Project Foundation

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

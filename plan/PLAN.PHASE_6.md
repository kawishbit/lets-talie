# Phase 6 — PWA & Deployment

- [ ] Add `pwa-192x192.png` and `pwa-512x512.png` to `public/`
- [ ] Update PWA manifest description in `astro.config.ts`
- [ ] Install `@astrojs/vercel` adapter
- [ ] Configure Vercel adapter in `astro.config.ts`
- [ ] Document required Vercel environment variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`


Expand phase 6 plan to include a few more considerations:
1. Create a Dockerfile so that the app can be self-hostable
2. Postgres connectionstring should be configured via environment variables, either via .env file or passed in during `docker run` 
3. Use nodemailer for email instead of resend library
4. Use host, port, username and password for SMTP setting, and all should be configured via environment variable like postgres above
5. 

Clarify with me first if you have any questions.
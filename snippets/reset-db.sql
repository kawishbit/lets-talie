-- Reset the database: drop EVERY table plus Drizzle's migration history,
-- so `bun run migrate` reapplies all migrations from scratch.
--
-- DESTRUCTIVE — permanently deletes all data and schema. There is no undo.
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/reset-db.sql
--   bun run migrate   # reapply migrations
--   bun run seed:demo # (optional) reseed

DROP SCHEMA public CASCADE;      -- drops all app + Better Auth tables
CREATE SCHEMA public;            -- recreate the (now empty) public schema
DROP SCHEMA IF EXISTS drizzle CASCADE; -- clears drizzle-kit's __drizzle_migrations history

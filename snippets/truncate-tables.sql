-- Empty EVERY table but keep the schema and Drizzle's migration history intact.
-- Use this to wipe all data without needing to re-run migrations.
--
-- DESTRUCTIVE — permanently deletes all rows. There is no undo.
-- CASCADE handles foreign keys; RESTART IDENTITY resets any sequences.
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/truncate-tables.sql

TRUNCATE TABLE
	transactions,
	transaction_categories,
	verification,
	account,
	session,
	"user"
RESTART IDENTITY CASCADE;

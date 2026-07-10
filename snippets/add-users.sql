-- Add one or more users directly via SQL.
-- Edit the `new_users` array below, then run this file against the DB.
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/add-users.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- provides gen_random_uuid()

WITH new_users (name, email, role) AS (
	VALUES
		-- (name, email, role) — role is 'user' or 'admin'
		('Jane Doe', 'jane@example.com', 'user'),
		('John Smith', 'john@example.com', 'admin')
)
INSERT INTO "user" (
	id, name, email, email_verified, role, account_balance, banned, created_at, updated_at
)
SELECT
	gen_random_uuid()::text,
	nu.name,
	nu.email,
	true,
	nu.role,
	'0.00',
	false,
	now(),
	now()
FROM new_users nu
ON CONFLICT (email) DO NOTHING;

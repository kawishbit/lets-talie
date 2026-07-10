-- Add one or more transaction categories directly via SQL.
-- Edit the `new_categories` array below, then run this file against the DB.
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/add-transaction-categories.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- provides gen_random_uuid()

WITH new_categories (label, remarks) AS (
	VALUES
		-- (label, remarks) — remarks may be NULL
		('Food & Drinks', 'Restaurants, bars, takeout'),
		('Transport', NULL)
)
INSERT INTO transaction_categories (id, label, remarks, created_at, updated_at)
SELECT
	gen_random_uuid()::text,
	nc.label,
	nc.remarks,
	now(),
	now()
FROM new_categories nc
WHERE NOT EXISTS (
	SELECT 1 FROM transaction_categories tc WHERE tc.label = nc.label
);

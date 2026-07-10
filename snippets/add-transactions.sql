-- Add one or more single transactions directly via SQL.
-- Edit the `new_transactions` array below, then run this file against the DB.
--
-- Notes:
--   * paid_by_email / created_by_email must match an existing user's email.
--   * category_label may be NULL, or must match an existing transaction_categories.label.
--   * type is 'deposit' or 'withdrawal'; status is 'pending', 'completed', or 'cancelled'.
--   * This only inserts rows into `transactions` — it does NOT touch
--     user.account_balance. Run the recalculation block at the bottom
--     afterwards (or call recalculateBalances() from the app) for any
--     users whose completed transactions changed.
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/add-transactions.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- provides gen_random_uuid()

WITH new_transactions (name, date, remarks, amount, type, status, paid_by_email, category_label) AS (
	VALUES
		-- (name, date, remarks, amount, type, status, paid_by_email, category_label)
		('Coffee run', now(), NULL, 12.50, 'withdrawal', 'completed', 'jane@example.com', 'Food & Drinks'),
		('Cash top-up', now(), NULL, 100.00, 'deposit', 'completed', 'jane@example.com', NULL)
),
inserted AS (
	INSERT INTO transactions (
		id, transaction_group_id, name, date, remarks, amount, type, status,
		created_by_user_id, last_updated_by_user_id, paid_by_user_id, category_id,
		created_at, updated_at
	)
	SELECT
		gen_random_uuid()::text,
		NULL,
		nt.name,
		nt.date,
		nt.remarks,
		nt.amount,
		nt.type,
		nt.status,
		u.id,
		NULL,
		u.id,
		tc.id,
		now(),
		now()
	FROM new_transactions nt
	JOIN "user" u ON u.email = nt.paid_by_email
	LEFT JOIN transaction_categories tc ON tc.label = nt.category_label
	RETURNING paid_by_user_id
)
-- Recalculate account_balance for every user affected by a completed
-- transaction above (balance = sum(deposits) - sum(withdrawals), completed only).
UPDATE "user" u
SET account_balance = COALESCE((
	SELECT SUM(
		CASE WHEN t.type = 'deposit' THEN t.amount::numeric ELSE -t.amount::numeric END
	)
	FROM transactions t
	WHERE t.paid_by_user_id = u.id
		AND t.status = 'completed'
		AND t.deleted_at IS NULL
), 0.00)::text
WHERE u.id IN (SELECT paid_by_user_id FROM inserted);

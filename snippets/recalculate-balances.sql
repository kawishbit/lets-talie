-- Recalculate account_balance for every user from their completed transactions.
--
-- Balance = SUM(deposits) − SUM(withdrawals) where status = 'completed'
-- and deleted_at IS NULL. Users with no matching transactions get 0.00.
-- Mirrors src/lib/balance.ts (recalculateBalances).
--
-- Safe to re-run anytime — only rewrites user.account_balance.
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/recalculate-balances.sql

UPDATE "user" u
SET account_balance = ROUND(COALESCE((
	SELECT SUM(
		CASE
			WHEN t.type = 'deposit' THEN t.amount::numeric
			ELSE -t.amount::numeric
		END
	)
	FROM transactions t
	WHERE t.paid_by_user_id = u.id
		AND t.status = 'completed'
		AND t.deleted_at IS NULL
), 0.00), 2)::text;

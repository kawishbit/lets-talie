-- Find non-deleted transactions that share the same calendar date
-- but use different transaction_group_id values (including NULL singles).
--
-- Useful for spotting possible duplicate group expenses re-entered
-- on the same day under a new group id.
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/find-same-date-different-group.sql

WITH day_groups AS (
	SELECT
		(date AT TIME ZONE 'UTC')::date AS day,
		-- Treat NULL group id as its own bucket so singles vs groups also match
		COALESCE(transaction_group_id::text, '__single__') AS group_key
	FROM transactions
	WHERE deleted_at IS NULL
	GROUP BY 1, 2
),
days_with_multiple_groups AS (
	SELECT day
	FROM day_groups
	GROUP BY day
	HAVING COUNT(*) > 1
)
SELECT
	(t.date AT TIME ZONE 'UTC')::date AS day,
	t.transaction_group_id,
	t.id,
	t.name,
	t.date,
	t.amount,
	t.type,
	t.status,
	t.paid_by_user_id,
	t.remarks,
	t.created_at
FROM transactions t
JOIN days_with_multiple_groups d
	ON (t.date AT TIME ZONE 'UTC')::date = d.day
WHERE t.deleted_at IS NULL
ORDER BY day, t.transaction_group_id NULLS FIRST, t.name, t.id;

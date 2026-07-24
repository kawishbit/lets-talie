-- Stagger transaction.date for groups that share the same calendar day
-- so each group sorts distinctly (ORDER BY date uses the full timestamp).
--
-- For every calendar day with 2+ non-null transaction_group_id values,
-- each group is assigned base_time + N minutes (N = 0, 1, 2, … ordered by
-- the group's earliest created_at, then group id). All rows in a group
-- get the same new date.
--
-- Safe to re-run: re-bases from the current earliest date per day among
-- those overlapping groups.
--
-- Preview first (optional):
--   See snippets/find-same-date-different-group.sql
--
-- Usage:
--   psql "$DATABASE_URL" -f snippets/stagger-same-day-group-dates.sql

WITH group_meta AS (
	SELECT
		transaction_group_id,
		(MIN(date) AT TIME ZONE 'UTC')::date AS day,
		MIN(created_at) AS first_created,
		MIN(date) AS group_date
	FROM transactions
	WHERE deleted_at IS NULL
		AND transaction_group_id IS NOT NULL
	GROUP BY transaction_group_id
),
days_with_overlap AS (
	SELECT day
	FROM group_meta
	GROUP BY day
	HAVING COUNT(*) > 1
),
ranked AS (
	SELECT
		gm.transaction_group_id,
		gm.day,
		ROW_NUMBER() OVER (
			PARTITION BY gm.day
			ORDER BY gm.first_created, gm.transaction_group_id
		) - 1 AS slot,
		MIN(gm.group_date) OVER (PARTITION BY gm.day) AS base_date
	FROM group_meta gm
	JOIN days_with_overlap d ON d.day = gm.day
)
UPDATE transactions t
SET
	date = r.base_date + (r.slot * INTERVAL '1 minute'),
	updated_at = now()
FROM ranked r
WHERE t.transaction_group_id = r.transaction_group_id
	AND t.deleted_at IS NULL;

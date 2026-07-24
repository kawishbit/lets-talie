/** Full datetime for Created-style columns (date + time, 24h). */
export function formatDate(iso: string) {
	return new Date(iso).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false, // Forces 24-hour format
	});
}

/** Date only — for transaction.date display (sort still uses full timestamp). */
export function formatDateOnly(iso: string) {
	return new Date(iso).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/** Local calendar day as `YYYY-MM-DD` for `<input type="date">`. */
export function toDateInputValue(
	isoOrDate: string | Date = new Date(),
): string {
	const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
	if (Number.isNaN(d.getTime())) return "";
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/**
 * Turn a date-input value (`YYYY-MM-DD`) into a full ISO timestamp without
 * collapsing to UTC midnight. Keeps wall-clock time from `timeSource`
 * (defaults to now — use the existing transaction date when editing).
 *
 * If `dateOnly` is already a full datetime string, it is parsed and returned
 * as ISO unchanged (aside from normalization).
 */
export function combineDateWithTime(
	dateOnly: string,
	timeSource: Date = new Date(),
): string {
	const trimmed = dateOnly.trim();
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
	if (!match) {
		const parsed = new Date(trimmed);
		if (Number.isNaN(parsed.getTime())) {
			return trimmed;
		}
		return parsed.toISOString();
	}

	const y = Number(match[1]);
	const m = Number(match[2]);
	const day = Number(match[3]);
	const combined = new Date(
		y,
		m - 1,
		day,
		timeSource.getHours(),
		timeSource.getMinutes(),
		timeSource.getSeconds(),
		timeSource.getMilliseconds(),
	);
	return combined.toISOString();
}

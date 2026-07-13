/**
 * Shared logic for resolving an import reference (paidByUserId, createdByUserId,
 * categoryId) that may be supplied either as an exact id (UUID) or as a
 * human-friendly name/label. Used by both the import API route (to rewrite
 * values to real UUIDs before inserting) and the ImportForm preview (to show
 * the resolved name/label to the admin before they submit).
 *
 * Matching rules:
 *   1. An exact id match always wins (search by UUID).
 *   2. Otherwise, a case-insensitive *substring* match against the label —
 *      "kaw" matches "Kawish". A single match resolves; zero or multiple matches
 *      are treated as unresolved (ambiguous names must be disambiguated by the
 *      admin, either with a more specific name or the exact id).
 */

export interface Reference {
	id: string;
	label: string;
}

export type ResolveResult =
	| { status: "resolved"; id: string; label: string }
	| { status: "none" }
	| { status: "ambiguous"; matches: Reference[] };

export function resolveReference(
	value: string,
	candidates: Reference[],
): ResolveResult {
	const trimmed = value.trim();
	if (trimmed === "") return { status: "none" };

	// Exact id (UUID) match takes precedence over name/label matching.
	const byId = candidates.find((c) => c.id === trimmed);
	if (byId) return { status: "resolved", id: byId.id, label: byId.label };

	// Case-insensitive substring match against the label/name.
	const term = trimmed.toLowerCase();
	const matches = candidates.filter((c) =>
		c.label.toLowerCase().includes(term),
	);

	if (matches.length === 1) {
		return { status: "resolved", id: matches[0].id, label: matches[0].label };
	}
	if (matches.length === 0) return { status: "none" };
	return { status: "ambiguous", matches };
}

/**
 * Resolves a reference to an id, or returns a human-readable error explaining
 * why it couldn't be resolved. Shared by the import API route (to reject the
 * import) and the ImportForm preview (to flag the row) so both surface the
 * exact same message. `field` is the column name (e.g. "categoryId") and
 * `entity` is the human noun (e.g. "category").
 */
export function resolveReferenceOrError(
	field: string,
	entity: string,
	value: string,
	candidates: Reference[],
): { id: string } | { error: string } {
	const result = resolveReference(value, candidates);
	if (result.status === "resolved") return { id: result.id };
	if (result.status === "ambiguous") {
		return {
			error: `${field} "${value}" matches multiple ${entity}s (${result.matches
				.map((m) => m.label)
				.join(", ")}) — use a more specific name or the exact id`,
		};
	}
	return {
		error: `${field} "${value}" did not match any ${entity} by id or name`,
	};
}

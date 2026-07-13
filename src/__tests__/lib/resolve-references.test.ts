import { resolveReference } from "@lib/resolve-references";
import { describe, expect, it } from "vitest";

const candidates = [
	{ id: "11111111-1111-1111-1111-111111111111", label: "John Doe" },
	{ id: "22222222-2222-2222-2222-222222222222", label: "Kawish" },
	{ id: "33333333-3333-3333-3333-333333333333", label: "Jane Doe" },
];

describe("resolveReference", () => {
	it("resolves an exact id match", () => {
		const result = resolveReference(
			"22222222-2222-2222-2222-222222222222",
			candidates,
		);
		expect(result).toEqual({
			status: "resolved",
			id: "22222222-2222-2222-2222-222222222222",
			label: "Kawish",
		});
	});

	it("resolves a case-insensitive substring name match", () => {
		const result = resolveReference("john", candidates);
		expect(result).toEqual({
			status: "resolved",
			id: "11111111-1111-1111-1111-111111111111",
			label: "John Doe",
		});
	});

	it("trims surrounding whitespace before matching", () => {
		const result = resolveReference("  Kawish  ", candidates);
		expect(result).toMatchObject({ status: "resolved", label: "Kawish" });
	});

	it("returns none for an empty/whitespace value", () => {
		expect(resolveReference("", candidates)).toEqual({ status: "none" });
		expect(resolveReference("   ", candidates)).toEqual({ status: "none" });
	});

	it("returns none when nothing matches", () => {
		expect(resolveReference("nobody", candidates)).toEqual({ status: "none" });
	});

	it("returns ambiguous when multiple labels contain the term", () => {
		const result = resolveReference("doe", candidates);
		expect(result.status).toBe("ambiguous");
		if (result.status === "ambiguous") {
			// both "John Doe" and "Jane Doe" contain "doe"
			expect(result.matches.map((m) => m.label)).toEqual([
				"John Doe",
				"Jane Doe",
			]);
		}
	});

	it("prefers an exact id match even if the id would also substring-match a label", () => {
		const tricky = [
			{ id: "abc", label: "First" },
			{ id: "zzz", label: "abc lookalike" },
		];
		const result = resolveReference("abc", tricky);
		expect(result).toEqual({ status: "resolved", id: "abc", label: "First" });
	});
});

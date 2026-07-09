// @vitest-environment node

import { formatDate } from "@utils/date";
import { describe, expect, it } from "vitest";

describe("formatDate", () => {
	it("formats a valid ISO date string to the expected display format", () => {
		const result = formatDate("2026-03-15T14:30:00.000Z");
		expect(result).toMatch(/Mar \d{1,2}, 2026/);
		expect(result).toContain(":");
	});

	it("handles midnight correctly", () => {
		const result = formatDate("2026-01-01T00:00:00.000Z");
		expect(result).toContain("2026");
	});

	it("handles end-of-month dates correctly", () => {
		const result = formatDate("2026-01-31T23:59:00.000Z");
		expect(result).toMatch(/Jan 31|Feb 1/);
	});

	it("handles a leap-year day correctly", () => {
		const result = formatDate("2024-02-29T12:00:00.000Z");
		expect(result).toContain("2024");
		expect(result).toMatch(/Feb 29|Feb 28|Mar 1/);
	});

	it("handles invalid date input gracefully", () => {
		const result = formatDate("not-a-date");
		expect(result).toBe("Invalid Date");
	});

	it("handles undefined date input gracefully", () => {
		// @ts-expect-error — exercising runtime behavior for bad input
		const result = formatDate(undefined);
		expect(result).toBe("Invalid Date");
	});
});

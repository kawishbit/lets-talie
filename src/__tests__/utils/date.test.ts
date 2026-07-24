// @vitest-environment node

import {
	combineDateWithTime,
	formatDate,
	formatDateOnly,
	toDateInputValue,
} from "@utils/date";
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

describe("formatDateOnly", () => {
	it("formats without a time component", () => {
		const result = formatDateOnly("2026-03-15T14:30:00.000Z");
		expect(result).toMatch(/Mar \d{1,2}, 2026/);
		expect(result).not.toContain(":");
	});
});

describe("toDateInputValue", () => {
	it("returns YYYY-MM-DD for a local Date", () => {
		const d = new Date(2026, 2, 15, 14, 30, 0);
		expect(toDateInputValue(d)).toBe("2026-03-15");
	});
});

describe("combineDateWithTime", () => {
	it("combines a date-only string with the clock time from timeSource", () => {
		const timeSource = new Date(2020, 0, 1, 14, 30, 45, 123);
		const iso = combineDateWithTime("2026-03-15", timeSource);
		const result = new Date(iso);
		expect(result.getFullYear()).toBe(2026);
		expect(result.getMonth()).toBe(2);
		expect(result.getDate()).toBe(15);
		expect(result.getHours()).toBe(14);
		expect(result.getMinutes()).toBe(30);
		expect(result.getSeconds()).toBe(45);
	});

	it("does not collapse date-only input to UTC midnight", () => {
		const timeSource = new Date(2020, 0, 1, 18, 0, 0, 0);
		const iso = combineDateWithTime("2026-06-01", timeSource);
		// Parsed ISO should retain a non-midnight wall time in local zone
		expect(new Date(iso).getHours()).toBe(18);
	});

	it("passes through a full ISO datetime string", () => {
		const iso = combineDateWithTime("2026-03-15T14:30:00.000Z");
		expect(iso).toBe("2026-03-15T14:30:00.000Z");
	});
});

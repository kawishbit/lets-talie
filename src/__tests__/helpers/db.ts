import { vi } from "vitest";

/**
 * A chainable, thenable stand-in for a Drizzle query builder. Every builder
 * method returns the same chain object, and the chain itself resolves (via
 * `then`) to whatever `result` is set to — regardless of which method call
 * was "last" before the `await`. This mirrors how Drizzle's query builders
 * are awaitable at any point in the chain.
 */
export function createChain<T>(result: T) {
	// biome-ignore lint/suspicious/noExplicitAny: generic chainable test double
	const chain: any = {
		__result: result,
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		orderBy: vi.fn(() => chain),
		limit: vi.fn(() => chain),
		offset: vi.fn(() => chain),
		set: vi.fn(() => chain),
		values: vi.fn(() => chain),
		returning: vi.fn(() => chain),
		// biome-ignore lint/suspicious/noThenProperty: intentionally thenable to mimic Drizzle's awaitable query builders
		then: (
			resolve: (value: T) => unknown,
			reject?: (error: unknown) => unknown,
		) => Promise.resolve(result).then(resolve, reject),
	};
	return chain;
}

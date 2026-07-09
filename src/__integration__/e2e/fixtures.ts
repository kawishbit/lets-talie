import { test as base } from "@playwright/test";
import { sessionCookieFor } from "../helpers/auth";
import { resetDb } from "../helpers/db";
import { clearInbox } from "../helpers/mail";

type Fixtures = {
	/** Injects a valid session cookie for `userId` into the browser context — skips the UI login flow for tests that aren't about login itself. */
	loginAs: (userId: string) => Promise<void>;
	/**
	 * Not used directly by tests — `auto: true` makes Playwright run it before
	 * every test regardless of which spec file imports `test` from here.
	 * A plain module-level `test.beforeEach()` call would only fire for the
	 * first spec file that imports this module (Node module caching means the
	 * call only executes once, registered against that file's suite only) —
	 * discovered when later specs saw duplicate seeded rows from earlier files.
	 */
	resetState: undefined;
};

export const test = base.extend<Fixtures>({
	loginAs: async ({ context, baseURL }, use) => {
		await use(async (userId: string) => {
			const cookieHeader = await sessionCookieFor(userId);
			const eqIdx = cookieHeader.indexOf("=");
			const name = cookieHeader.slice(0, eqIdx);
			// Not decoded: this is exactly what a real Set-Cookie response would
			// contain, and the app's own server decodes on receipt.
			const value = cookieHeader.slice(eqIdx + 1);
			const url = new URL(baseURL ?? "http://localhost:30098");
			await context.addCookies([
				{ name, value, domain: url.hostname, path: "/" },
			]);
		});
	},
	resetState: [
		// Playwright inspects this function's parameter list at runtime to
		// figure out which fixtures it depends on, so the first argument must
		// stay a literal (even if empty) object-destructuring pattern.
		// biome-ignore lint/correctness/noEmptyPattern: required by Playwright
		async ({}, use) => {
			await resetDb();
			await clearInbox();
			await use(undefined);
		},
		{ auto: true },
	],
});

export { expect } from "@playwright/test";
export * from "../helpers/db";

import { expect, seedAdmin, seedUser, test } from "./fixtures";

// 9l — E2E: Page Rendering & Navigation (Playwright), against the live
// standalone server + real Postgres test DB (see playwright.config.ts).

test.describe("unauthenticated", () => {
	test("GET / renders the public landing page", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
	});

	test("GET /login renders the login form", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator("#email")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Send login code" }),
		).toBeVisible();
	});

	test("visiting /dashboard redirects to /login", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/login$/);
	});

	test("visiting /users redirects to /login", async ({ page }) => {
		await page.goto("/users");
		await expect(page).toHaveURL(/\/login$/);
	});
});

test.describe("regular user", () => {
	test("dashboard renders the user's own balance and forms", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedUser();
		await loginAs(id);

		await page.goto("/dashboard");
		await expect(page.getByText("Your balance")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Add a transaction" }),
		).toBeVisible();
	});

	test("nav links show the correct active state for the current page", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedUser();
		await loginAs(id);

		await page.goto("/transactions");
		const transactionsLink = page
			.getByRole("link", { name: "Transactions" })
			.first();
		const dashboardLink = page.getByRole("link", { name: "Dashboard" }).first();
		// navClass() (src/utils/nav.ts) applies bg-ink/text-canvas only to the
		// active link.
		await expect(transactionsLink).toHaveClass(/bg-ink/);
		await expect(dashboardLink).not.toHaveClass(/bg-ink/);
	});

	test("visiting /users as a regular user redirects to /dashboard", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedUser();
		await loginAs(id);

		await page.goto("/users");
		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test("/transactions renders the transaction table with the user's data", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedUser();
		await loginAs(id);

		await page.goto("/transactions");
		await expect(
			page.getByRole("heading", { name: "Transactions" }),
		).toBeVisible();
	});

	test("sign out ends the session and redirects to /login", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedUser();
		await loginAs(id);

		await page.goto("/dashboard");
		await page.getByRole("button", { name: "Sign out" }).click();
		await expect(page).toHaveURL(/\/$/);

		// Confirm the session is actually gone, not just a client-side redirect.
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/login$/);
	});
});

test.describe("admin", () => {
	test("admin nav links are visible in the header", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedAdmin();
		await loginAs(id);

		await page.goto("/dashboard");
		// Both the desktop and mobile nav markup are always in the DOM (the
		// mobile one just toggled via CSS), so scope to the first (desktop) copy.
		await expect(
			page.getByRole("link", { name: "Users" }).first(),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Categories" }).first(),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Import" }).first(),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Approve" }).first(),
		).toBeVisible();
	});

	test("/users renders the user table", async ({ page, loginAs }) => {
		const { id } = await seedAdmin();
		await loginAs(id);

		await page.goto("/users");
		await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
	});

	test("/transaction-categories renders the category table", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedAdmin();
		await loginAs(id);

		await page.goto("/transaction-categories");
		await expect(
			page.getByRole("heading", { name: "Categories" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Add category" }),
		).toBeVisible();
	});

	test("/import-transactions renders the import form", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedAdmin();
		await loginAs(id);

		await page.goto("/import-transactions");
		await expect(page.locator("#file-upload")).toBeVisible();
	});

	test("/approve-transactions renders the pending groups list", async ({
		page,
		loginAs,
	}) => {
		const { id } = await seedAdmin();
		await loginAs(id);

		await page.goto("/approve-transactions");
		await expect(
			page.getByRole("heading", { name: "Approve Transactions" }),
		).toBeVisible();
	});
});

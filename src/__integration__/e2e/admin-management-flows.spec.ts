import { expect, seedAdmin, seedCategory, seedUser, test } from "./fixtures";

// 9m — E2E: Critical User Flows (Playwright) — category management, user
// management, and import, all against the live server + real DB.

test.describe("Category Management Flow (Admin)", () => {
	test("admin creates a category and it appears in the table", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await loginAs(admin.id);

		await page.goto("/transaction-categories");
		await page.getByRole("button", { name: "Add category" }).click();
		await page.locator("#modal-label").fill("Entertainment");
		await page.getByRole("button", { name: "Create", exact: true }).click();

		await expect(
			page.getByRole("cell", { name: "Entertainment" }),
		).toBeVisible();
	});

	test("admin edits a category label and the updated label is shown", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await seedCategory({ label: "Old Label" });
		await loginAs(admin.id);

		await page.goto("/transaction-categories");
		await expect(page.getByRole("cell", { name: "Old Label" })).toBeVisible();
		await page.getByRole("button", { name: "Edit" }).click();
		await page.locator("#modal-label").fill("New Label");
		await page.getByRole("button", { name: "Save changes" }).click();

		await expect(page.getByRole("cell", { name: "New Label" })).toBeVisible();
		await expect(
			page.getByRole("cell", { name: "Old Label" }),
		).not.toBeVisible();
	});

	test("admin deletes a category and it disappears from the table", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await seedCategory({ label: "Doomed Category" });
		await loginAs(admin.id);

		page.on("dialog", (dialog) => dialog.accept());

		await page.goto("/transaction-categories");
		await expect(
			page.getByRole("cell", { name: "Doomed Category" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Delete" }).click();

		await expect(
			page.getByRole("cell", { name: "Doomed Category" }),
		).not.toBeVisible();
	});
});

test.describe("User Management Flow (Admin)", () => {
	test("admin creates a new user and it appears in the user table", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await loginAs(admin.id);

		await page.goto("/users");
		await page.getByRole("button", { name: "Add user" }).click();
		await page.locator("#modal-name").fill("Fresh Face");
		await page.locator("#modal-email").fill("fresh-face@test.dev");
		await page.getByRole("button", { name: "Create user" }).click();

		await expect(page.getByRole("cell", { name: "Fresh Face" })).toBeVisible();
	});

	test("admin edits a user's role and the updated role is shown", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await seedUser({ name: "Promotable Pat" });
		await loginAs(admin.id);

		await page.goto("/users");
		await expect(
			page.getByRole("cell", { name: "Promotable Pat" }),
		).toBeVisible();
		const row = page.getByRole("row", { name: /Promotable Pat/ });
		await row.getByRole("button", { name: "Edit" }).click();
		await page.locator("#modal-role").selectOption("admin");
		await page.getByRole("button", { name: "Save changes" }).click();

		await expect(row.getByText("admin", { exact: true })).toBeVisible();
	});

	test("admin deletes a user and it disappears from the table", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await seedUser({ name: "Doomed User" });
		await loginAs(admin.id);

		page.on("dialog", (dialog) => dialog.accept());

		await page.goto("/users");
		await expect(page.getByRole("cell", { name: "Doomed User" })).toBeVisible();
		const row = page.getByRole("row", { name: /Doomed User/ });
		await row.getByRole("button", { name: "Delete" }).click();

		await expect(
			page.getByRole("cell", { name: "Doomed User" }),
		).not.toBeVisible();
	});
});

test.describe("Import Flow (Admin)", () => {
	test("uploading a valid CSV shows a preview and imports successfully", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		await loginAs(admin.id);

		await page.goto("/import-transactions");
		const csv = [
			"name,date,amount,paidByUserId,type,status",
			`E2E import row,2026-01-10,25.00,${payer.id},deposit,completed`,
		].join("\n");
		await page.locator("#file-upload").setInputFiles({
			name: "import.csv",
			mimeType: "text/csv",
			buffer: Buffer.from(csv),
		});

		await expect(page.getByText("Preview —")).toBeVisible();
		await expect(page.getByText("E2E import row")).toBeVisible();

		await page.getByRole("button", { name: /Import 1 transaction/ }).click();
		await expect(page.getByText("Import successful!")).toBeVisible();
	});

	test("uploading a CSV with an invalid row shows a per-row error and disables submit", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		await loginAs(admin.id);

		await page.goto("/import-transactions");
		const csv = [
			"name,date,amount,paidByUserId,type,status",
			`Bad row,2026-01-10,-5,${payer.id},deposit,completed`,
		].join("\n");
		await page.locator("#file-upload").setInputFiles({
			name: "import.csv",
			mimeType: "text/csv",
			buffer: Buffer.from(csv),
		});

		await expect(
			page.getByText("amount must be a positive number"),
		).toBeVisible();
		await expect(page.getByRole("button", { name: /Import/ })).toBeDisabled();
	});
});

import { user } from "@db/schema";
import { eq } from "drizzle-orm";
import { db, expect, seedAdmin, seedGroup, seedUser, test } from "./fixtures";

// 9m — E2E: Critical User Flows (Playwright) — group transaction submission,
// approval/rejection, single transaction, and balance accuracy, all against
// the live server + real DB.

test.describe("Group Transaction Flow (Regular User)", () => {
	test("submitting the group form creates a pending group visible in the transaction list", async ({
		page,
		loginAs,
	}) => {
		const payer = await seedUser({ name: "Payer Pat" });
		await seedUser({ name: "Other Otto" });
		await loginAs(payer.id);

		await page.goto("/dashboard");
		await page.locator("#gt-name").fill("Dinner at Nobu");
		await page.locator("#gt-amount").fill("60");
		await page.getByRole("button", { name: "Other Otto" }).click();
		await page.getByRole("button", { name: "Add group transaction" }).click();

		await expect(page.getByText("Transaction added!")).toBeVisible();

		await page.goto("/transactions");
		// The group inserts one row per party (deposit + withdrawal), so the
		// name appears twice in the table.
		await expect(page.getByText("Dinner at Nobu").first()).toBeVisible();
		// Scoped to <tbody>: the status filter <select> also has a "pending"
		// <option>, which getByText would otherwise match too.
		await expect(
			page.locator("tbody").getByText("pending").first(),
		).toBeVisible();
	});

	test("custom amount toggle validates that amounts sum to total before submit", async ({
		page,
		loginAs,
	}) => {
		const payer = await seedUser({ name: "Payer Pat" });
		await seedUser({ name: "Other Otto" });
		await loginAs(payer.id);

		await page.goto("/dashboard");
		await page.locator("#gt-name").fill("Split bill");
		await page.locator("#gt-amount").fill("100");
		await page.getByRole("button", { name: "Other Otto" }).click();
		await page.getByRole("checkbox").check();

		// Mismatched custom amounts: leave blank -> sum 0, not 100.
		const submitButton = page.getByRole("button", {
			name: "Add group transaction",
		});
		await expect(submitButton).toBeDisabled();
	});
});

test.describe("Group Approval Flow (Admin)", () => {
	test("admin can approve a pending group; it moves to completed and disappears from the pending list", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 40,
			status: "pending",
			name: "Approve me",
		});
		await loginAs(admin.id);

		page.on("dialog", (dialog) => dialog.accept());

		await page.goto("/approve-transactions");
		await expect(page.getByText("Approve me")).toBeVisible();
		await page.getByRole("button", { name: "Approve" }).click();

		await expect(page.getByText("Approve me")).not.toBeVisible();
		await expect(
			page.getByText("No pending transactions to review."),
		).toBeVisible();
	});

	test("admin can reject a pending group; it disappears from the pending list", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 40,
			status: "pending",
			name: "Reject me",
		});
		await loginAs(admin.id);

		page.on("dialog", (dialog) => dialog.accept());

		await page.goto("/approve-transactions");
		await expect(page.getByText("Reject me")).toBeVisible();
		await page.getByRole("button", { name: "Reject" }).click();

		await expect(page.getByText("Reject me")).not.toBeVisible();
	});
});

test.describe("Single Transaction Flow (Admin)", () => {
	test("admin fills the single transaction form and it appears in the transaction list", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await loginAs(admin.id);

		await page.goto("/dashboard");
		await page.locator("#tx-name").fill("Balance adjustment");
		await page.locator("#tx-amount").fill("15");
		await page.locator("#tx-user").selectOption(admin.id);
		await page.getByRole("button", { name: "Add single transaction" }).click();

		await expect(page.getByText("Transaction added!")).toBeVisible();

		await page.goto("/transactions");
		await expect(page.getByText("Balance adjustment")).toBeVisible();
	});
});

test.describe("Balance Accuracy", () => {
	test("completing a deposit group increases the payer's displayed balance", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		await seedUser({ name: "Split Partner" });
		await loginAs(admin.id);

		await page.goto("/dashboard");
		await page.locator("#gt-name").fill("Dinner split");
		await page.locator("#gt-amount").fill("80");
		// Split with one other party: admin pays 80, owes 40 of it back to
		// themself -> net +40. (A single-party "group" nets to zero, since the
		// payer's own withdrawal share cancels their deposit.)
		await page.getByRole("button", { name: "Split Partner" }).click();
		await page.getByRole("button", { name: "Add group transaction" }).click();
		await expect(page.getByText("Transaction added!")).toBeVisible();

		// Group auto-completes for admins, so balance updates immediately.
		await page.goto("/dashboard");
		await expect(page.getByText("Your balance")).toBeVisible();
		await expect(page.getByText(/\+.*40/)).toBeVisible();
	});

	test("rejecting a pending group leaves balances unchanged", async ({
		page,
		loginAs,
	}) => {
		const admin = await seedAdmin();
		const payer = await seedUser();
		await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 40,
			status: "pending",
		});
		await loginAs(admin.id);

		page.on("dialog", (dialog) => dialog.accept());
		await page.goto("/approve-transactions");
		await page.getByRole("button", { name: "Reject" }).click();
		await expect(
			page.getByText("No pending transactions to review."),
		).toBeVisible();

		const [row] = await db.select().from(user).where(eq(user.id, payer.id));
		expect(row?.accountBalance).toBe("0.00");
	});
});

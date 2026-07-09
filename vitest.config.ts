import { fileURLToPath } from "node:url";
import { getViteConfig } from "astro/config";

export default getViteConfig({
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/__tests__/setup.ts"],
		include: ["src/__tests__/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			// Scoped to the units Phase 8 actually covers. Routes that are mostly
			// read/join logic (GET /api/transactions, pending groups) and the
			// Better Auth catch-all are exercised against a real DB in Phase 9
			// integration tests instead. src/utils/nav.ts and DataTable.vue /
			// SignOutButton.vue are trivial passthroughs not worth unit coverage.
			include: [
				"src/lib/balance.ts",
				"src/lib/queries.ts",
				"src/utils/date.ts",
				"src/middleware.ts",
				"src/pages/api/transactions/group/**/*.ts",
				"src/pages/api/transactions/single.ts",
				"src/pages/api/transactions/import.ts",
				"src/pages/api/categories/**/*.ts",
				"src/pages/api/users/**/*.ts",
				"src/components/LoginForm.vue",
				"src/components/GroupTransactionForm.vue",
				"src/components/SingleTransactionForm.vue",
				"src/components/TransactionTable.vue",
				"src/components/UserTable.vue",
				"src/components/UserFormModal.vue",
				"src/components/CategoryTable.vue",
				"src/components/CategoryFormModal.vue",
				"src/components/ImportForm.vue",
				"src/components/ApproveTransactions.vue",
			],
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 70,
				statements: 70,
			},
		},
		resolve: {
			alias: {
				"@components": fileURLToPath(
					new URL("./src/components", import.meta.url),
				),
				"@layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
				"@pages": fileURLToPath(new URL("./src/pages", import.meta.url)),
				"@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
				"@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
				"@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
				"@db": fileURLToPath(new URL("./src/db", import.meta.url)),
			},
		},
	},
});

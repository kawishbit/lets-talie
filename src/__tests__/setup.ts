import { afterEach, vi } from "vitest";

vi.stubEnv("DATABASE_URL", "postgres://test:test@localhost:5432/test");
vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:30001");
vi.stubEnv("PUBLIC_DEMO_MODE", "false");
vi.stubEnv("PUBLIC_CURRENCY_CODE", "USD");

// `db` is mocked globally so route/business-logic tests never touch a real
// database. Each test configures return values on `db.select` / `db.insert`
// / `db.update` / `db.transaction` directly (see src/__tests__/helpers/db.ts).
vi.mock("@db/database", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		transaction: vi.fn(),
	},
}));

afterEach(() => {
	vi.clearAllMocks();
});

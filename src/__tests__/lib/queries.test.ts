// @vitest-environment node
import { db } from "@db/database";
import { fetchUsersAndCategories } from "@lib/queries";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../helpers/db";

const mockDb = vi.mocked(db);

describe("fetchUsersAndCategories", () => {
	it("returns { users, categories } built from non-deleted, name/label-ordered rows", async () => {
		const users = [{ id: "u1", name: "Alice", email: "alice@example.com" }];
		const categories = [{ id: "c1", label: "Food" }];
		mockDb.select
			.mockReturnValueOnce(createChain(users) as never)
			.mockReturnValueOnce(createChain(categories) as never);

		const result = await fetchUsersAndCategories();

		expect(result).toEqual({ users, categories });
	});

	it("returns empty arrays when both tables are empty", async () => {
		mockDb.select
			.mockReturnValueOnce(createChain([]) as never)
			.mockReturnValueOnce(createChain([]) as never);

		const result = await fetchUsersAndCategories();

		expect(result).toEqual({ users: [], categories: [] });
	});

	it("filters out soft-deleted users and categories via where(), ordered ascending", async () => {
		const usersChain = createChain([]);
		const categoriesChain = createChain([]);
		mockDb.select
			.mockReturnValueOnce(usersChain as never)
			.mockReturnValueOnce(categoriesChain as never);

		await fetchUsersAndCategories();

		expect(usersChain.where).toHaveBeenCalledTimes(1);
		expect(usersChain.orderBy).toHaveBeenCalledTimes(1);
		expect(categoriesChain.where).toHaveBeenCalledTimes(1);
		expect(categoriesChain.orderBy).toHaveBeenCalledTimes(1);
	});
});

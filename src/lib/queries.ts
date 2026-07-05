import { db } from "@db/database";
import { transactionCategories, user } from "@db/schema";
import { asc, isNull } from "drizzle-orm";

export type UserOption = { id: string; name: string; email: string };
export type CategoryOption = { id: string; label: string };

export async function fetchUsersAndCategories(): Promise<{
	users: UserOption[];
	categories: CategoryOption[];
}> {
	const [users, categories] = await Promise.all([
		db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(isNull(user.deletedAt))
			.orderBy(asc(user.name)),
		db
			.select({
				id: transactionCategories.id,
				label: transactionCategories.label,
			})
			.from(transactionCategories)
			.where(isNull(transactionCategories.deletedAt))
			.orderBy(asc(transactionCategories.label)),
	]);
	return { users, categories };
}

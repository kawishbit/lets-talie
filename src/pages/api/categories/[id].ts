import { db } from "@db/database";
import { transactionCategories } from "@db/schema";
import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";

export const PATCH: APIRoute = async ({ locals, request, params }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id } = params;
	if (!id) {
		return Response.json({ error: "Missing id" }, { status: 400 });
	}

	let body: { label?: string; remarks?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (body.label !== undefined) {
		if (typeof body.label !== "string" || body.label.trim().length === 0) {
			return Response.json(
				{ error: "label must be a non-empty string" },
				{ status: 400 },
			);
		}
		updates.label = body.label.trim();
	}
	if (body.remarks !== undefined) {
		updates.remarks = body.remarks?.trim() ?? null;
	}

	const [updated] = await db
		.update(transactionCategories)
		.set(updates)
		.where(
			and(
				eq(transactionCategories.id, id),
				isNull(transactionCategories.deletedAt),
			),
		)
		.returning({ id: transactionCategories.id });

	if (!updated) {
		return Response.json({ error: "Category not found" }, { status: 404 });
	}

	return Response.json({ id: updated.id });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id } = params;
	if (!id) {
		return Response.json({ error: "Missing id" }, { status: 400 });
	}

	const now = new Date();
	const [deleted] = await db
		.update(transactionCategories)
		.set({ deletedAt: now, updatedAt: now })
		.where(
			and(
				eq(transactionCategories.id, id),
				isNull(transactionCategories.deletedAt),
			),
		)
		.returning({ id: transactionCategories.id });

	if (!deleted) {
		return Response.json({ error: "Category not found" }, { status: 404 });
	}

	return Response.json({ id: deleted.id, deleted: true });
};

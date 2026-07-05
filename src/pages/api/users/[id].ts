import { db } from "@db/database";
import { user } from "@db/schema";
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

	let body: { name?: string; email?: string; role?: "user" | "admin" };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (body.name !== undefined) {
		if (typeof body.name !== "string" || body.name.trim().length === 0) {
			return Response.json(
				{ error: "name must be a non-empty string" },
				{ status: 400 },
			);
		}
		updates.name = body.name.trim();
	}

	if (body.email !== undefined) {
		if (typeof body.email !== "string" || !body.email.includes("@")) {
			return Response.json(
				{ error: "email must be a valid email address" },
				{ status: 400 },
			);
		}
		updates.email = body.email.trim().toLowerCase();
	}

	if (body.role !== undefined) {
		if (!["user", "admin"].includes(body.role)) {
			return Response.json(
				{ error: 'role must be "user" or "admin"' },
				{ status: 400 },
			);
		}
		updates.role = body.role;
	}

	const [updated] = await db
		.update(user)
		.set(updates)
		.where(and(eq(user.id, id), isNull(user.deletedAt)))
		.returning({ id: user.id });

	if (!updated) {
		return Response.json({ error: "User not found" }, { status: 404 });
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

	// Prevent self-deletion
	if (id === sessionUser.id) {
		return Response.json(
			{ error: "Cannot delete your own account" },
			{ status: 400 },
		);
	}

	const now = new Date();
	const [deleted] = await db
		.update(user)
		.set({ deletedAt: now, updatedAt: now })
		.where(and(eq(user.id, id), isNull(user.deletedAt)))
		.returning({ id: user.id });

	if (!deleted) {
		return Response.json({ error: "User not found" }, { status: 404 });
	}

	return Response.json({ id: deleted.id, deleted: true });
};

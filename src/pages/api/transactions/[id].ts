import { db } from "@db/database";
import { transactions } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";

interface PatchBody {
	name?: string;
	date?: string;
	remarks?: string | null;
	amount?: number;
	type?: "deposit" | "withdrawal";
	paidByUserId?: string;
	status?: "pending" | "completed" | "cancelled";
	categoryId?: string | null;
}

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

	let body: PatchBody;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const hasAnyField =
		body.name !== undefined ||
		body.date !== undefined ||
		body.remarks !== undefined ||
		body.amount !== undefined ||
		body.type !== undefined ||
		body.paidByUserId !== undefined ||
		body.status !== undefined ||
		body.categoryId !== undefined;

	if (!hasAnyField) {
		return Response.json(
			{ error: "At least one field is required" },
			{ status: 400 },
		);
	}

	const [existing] = await db
		.select()
		.from(transactions)
		.where(and(eq(transactions.id, id), isNull(transactions.deletedAt)));

	if (!existing) {
		return Response.json({ error: "Transaction not found" }, { status: 404 });
	}

	const updates: Record<string, unknown> = {
		updatedAt: new Date(),
		lastUpdatedByUserId: sessionUser.id,
	};

	if (body.name !== undefined) {
		if (typeof body.name !== "string" || body.name.trim().length === 0) {
			return Response.json(
				{ error: "name must be a non-empty string" },
				{ status: 400 },
			);
		}
		updates.name = body.name.trim();
	}

	if (body.date !== undefined) {
		if (typeof body.date !== "string" || body.date.trim().length === 0) {
			return Response.json(
				{ error: "date must be a non-empty string" },
				{ status: 400 },
			);
		}
		const txDate = new Date(body.date);
		if (Number.isNaN(txDate.getTime())) {
			return Response.json({ error: "Invalid date format" }, { status: 400 });
		}
		updates.date = txDate;
	}

	if (body.remarks !== undefined) {
		if (body.remarks !== null && typeof body.remarks !== "string") {
			return Response.json(
				{ error: "remarks must be a string or null" },
				{ status: 400 },
			);
		}
		updates.remarks =
			body.remarks === null || body.remarks.trim() === ""
				? null
				: body.remarks.trim();
	}

	if (body.amount !== undefined) {
		if (typeof body.amount !== "number" || body.amount <= 0) {
			return Response.json(
				{ error: "amount must be a number greater than 0" },
				{ status: 400 },
			);
		}
		updates.amount = body.amount.toFixed(2);
	}

	if (body.type !== undefined) {
		if (!["deposit", "withdrawal"].includes(body.type)) {
			return Response.json(
				{ error: 'type must be "deposit" or "withdrawal"' },
				{ status: 400 },
			);
		}
		updates.type = body.type;
	}

	if (body.paidByUserId !== undefined) {
		if (
			typeof body.paidByUserId !== "string" ||
			body.paidByUserId.trim().length === 0
		) {
			return Response.json(
				{ error: "paidByUserId must be a non-empty string" },
				{ status: 400 },
			);
		}
		updates.paidByUserId = body.paidByUserId;
	}

	if (body.status !== undefined) {
		if (!["pending", "completed", "cancelled"].includes(body.status)) {
			return Response.json(
				{ error: 'status must be "pending", "completed", or "cancelled"' },
				{ status: 400 },
			);
		}
		updates.status = body.status;
	}

	if (body.categoryId !== undefined) {
		if (body.categoryId !== null && typeof body.categoryId !== "string") {
			return Response.json(
				{ error: "categoryId must be a string or null" },
				{ status: 400 },
			);
		}
		updates.categoryId =
			body.categoryId === null || body.categoryId === ""
				? null
				: body.categoryId;
	}

	await db
		.update(transactions)
		.set(updates)
		.where(and(eq(transactions.id, id), isNull(transactions.deletedAt)));

	const nextStatus = (updates.status as string | undefined) ?? existing.status;
	const nextPaidBy =
		(updates.paidByUserId as string | undefined) ?? existing.paidByUserId;

	const affected = new Set<string>();
	if (existing.status === "completed") {
		affected.add(existing.paidByUserId);
	}
	if (nextStatus === "completed") {
		affected.add(nextPaidBy);
	}

	if (affected.size > 0) {
		await recalculateBalances([...affected]);
	}

	return Response.json({ id });
};

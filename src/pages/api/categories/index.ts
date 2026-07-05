import { db } from "@db/database";
import { transactionCategories } from "@db/schema";
import type { APIRoute } from "astro";
import { asc, isNull, sql } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 20;

export const GET: APIRoute = async ({ locals, url }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
	const pageSize = Math.min(
		100,
		Math.max(
			1,
			parseInt(
				url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
				10,
			),
		),
	);
	const offset = (page - 1) * pageSize;

	const [items, [{ total }]] = await Promise.all([
		db
			.select()
			.from(transactionCategories)
			.where(isNull(transactionCategories.deletedAt))
			.orderBy(asc(transactionCategories.label))
			.limit(pageSize)
			.offset(offset),

		db
			.select({ total: sql<number>`COUNT(*)::int` })
			.from(transactionCategories)
			.where(isNull(transactionCategories.deletedAt)),
	]);

	return Response.json({ items, total, page, pageSize });
};

export const POST: APIRoute = async ({ locals, request }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	let body: { label: string; remarks?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { label } = body;
	if (!label || typeof label !== "string" || label.trim().length === 0) {
		return Response.json({ error: "label is required" }, { status: 400 });
	}

	const now = new Date();
	const id = crypto.randomUUID();

	await db.insert(transactionCategories).values({
		id,
		label: label.trim(),
		remarks: body.remarks?.trim() ?? null,
		createdAt: now,
		updatedAt: now,
	});

	return Response.json({ id }, { status: 201 });
};

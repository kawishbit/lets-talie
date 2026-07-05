import { db } from "@db/database";
import { user } from "@db/schema";
import type { APIRoute } from "astro";
import { asc, isNull, sql } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 20;

export const GET: APIRoute = async ({ locals, url }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
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
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				accountBalance: user.accountBalance,
				emailVerified: user.emailVerified,
				createdAt: user.createdAt,
				deletedAt: user.deletedAt,
			})
			.from(user)
			.where(isNull(user.deletedAt))
			.orderBy(asc(user.name))
			.limit(pageSize)
			.offset(offset),

		db
			.select({ total: sql<number>`COUNT(*)::int` })
			.from(user)
			.where(isNull(user.deletedAt)),
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

	let body: { name: string; email: string; role?: "user" | "admin" };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { name, email } = body;
	if (
		!name ||
		typeof name !== "string" ||
		name.trim().length === 0 ||
		!email ||
		typeof email !== "string" ||
		!email.includes("@")
	) {
		return Response.json(
			{ error: "name and a valid email are required" },
			{ status: 400 },
		);
	}

	const role = body.role === "admin" ? "admin" : "user";
	const now = new Date();
	const id = crypto.randomUUID();

	await db.insert(user).values({
		id,
		name: name.trim(),
		email: email.trim().toLowerCase(),
		emailVerified: false,
		role,
		accountBalance: "0.00",
		createdAt: now,
		updatedAt: now,
	});

	return Response.json({ id }, { status: 201 });
};

import { db } from "@db/database";
import { transactions } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import type { APIRoute } from "astro";

interface SingleTransactionBody {
	name: string;
	date: string;
	remarks?: string;
	amount: number;
	paidByUserId: string;
	type: "deposit" | "withdrawal";
	status: "pending" | "completed" | "cancelled";
	categoryId?: string;
}

export const POST: APIRoute = async ({ locals, request }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	let body: SingleTransactionBody;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { name, date, amount, paidByUserId, type, status } = body;
	if (
		!name ||
		!date ||
		typeof amount !== "number" ||
		!paidByUserId ||
		!["deposit", "withdrawal"].includes(type) ||
		!["pending", "completed", "cancelled"].includes(status)
	) {
		return Response.json(
			{
				error:
					"Missing or invalid required fields: name, date, amount, paidByUserId, type, status",
			},
			{ status: 400 },
		);
	}

	if (amount <= 0) {
		return Response.json(
			{ error: "Amount must be greater than 0" },
			{ status: 400 },
		);
	}

	const txDate = new Date(date);
	if (Number.isNaN(txDate.getTime())) {
		return Response.json({ error: "Invalid date format" }, { status: 400 });
	}

	const now = new Date();
	const id = crypto.randomUUID();

	await db.insert(transactions).values({
		id,
		transactionGroupId: null,
		name,
		date: txDate,
		remarks: body.remarks ?? null,
		amount: amount.toFixed(2),
		type,
		status,
		paidByUserId,
		categoryId: body.categoryId ?? null,
		createdByUserId: sessionUser.id,
		createdAt: now,
		updatedAt: now,
	});

	if (status === "completed") {
		await recalculateBalances([paidByUserId]);
	}

	return Response.json({ id }, { status: 201 });
};

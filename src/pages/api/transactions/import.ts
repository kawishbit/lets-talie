import { db } from "@db/database";
import { transactions } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import { parseCsv } from "@lib/csv";
import { fetchUsersAndCategories } from "@lib/queries";
import {
	type Reference,
	resolveReferenceOrError,
} from "@lib/resolve-references";
import type { APIRoute } from "astro";

interface Lookups {
	userRefs: Reference[];
	categoryRefs: Reference[];
}

interface ImportRow {
	name: string;
	date: string;
	remarks?: string;
	amount: number | string;
	paidByUserId: string;
	type: string;
	status: string;
	categoryId?: string;
	transactionGroupId?: string;
	createdAt?: string;
	createdByUserId?: string;
}

interface ValidatedRow {
	name: string;
	date: Date;
	remarks: string | null;
	amount: string;
	paidByUserId: string;
	type: "deposit" | "withdrawal";
	status: "pending" | "completed" | "cancelled";
	categoryId: string | null;
	transactionGroupId: string | null;
	createdAt: Date | null;
	createdByUserId: string | null;
}

interface RowError {
	row: number;
	errors: string[];
}

function validateRows(
	rows: ImportRow[],
	lookups: Lookups,
): {
	validRows: ValidatedRow[];
	errors: RowError[];
} {
	const validRows: ValidatedRow[] = [];
	const errors: RowError[] = [];

	rows.forEach((row, idx) => {
		const rowNum = idx + 1;
		const rowErrors: string[] = [];

		if (!row.name || String(row.name).trim().length === 0) {
			rowErrors.push("name is required");
		}

		const txDate = row.date ? new Date(row.date) : null;
		if (!txDate || Number.isNaN(txDate.getTime())) {
			rowErrors.push("date must be a valid date string");
		}

		const amount =
			typeof row.amount === "string" ? parseFloat(row.amount) : row.amount;
		if (Number.isNaN(amount) || amount <= 0) {
			rowErrors.push("amount must be a positive number");
		}

		// paidByUserId is required and is resolved from a UUID or a user name.
		let resolvedPaidBy: string | null = null;
		if (!row.paidByUserId || String(row.paidByUserId).trim().length === 0) {
			rowErrors.push("paidByUserId is required");
		} else {
			const resolved = resolveReferenceOrError(
				"paidByUserId",
				"user",
				String(row.paidByUserId),
				lookups.userRefs,
			);
			if ("error" in resolved) rowErrors.push(resolved.error);
			else resolvedPaidBy = resolved.id;
		}

		// createdByUserId is optional; when provided, resolve UUID or user name.
		let resolvedCreatedBy: string | null = null;
		const createdByRaw = row.createdByUserId?.trim();
		if (createdByRaw) {
			const resolved = resolveReferenceOrError(
				"createdByUserId",
				"user",
				createdByRaw,
				lookups.userRefs,
			);
			if ("error" in resolved) rowErrors.push(resolved.error);
			else resolvedCreatedBy = resolved.id;
		}

		// categoryId is optional; when provided, resolve UUID or category label.
		let resolvedCategory: string | null = null;
		const categoryRaw = row.categoryId?.trim();
		if (categoryRaw) {
			const resolved = resolveReferenceOrError(
				"categoryId",
				"category",
				categoryRaw,
				lookups.categoryRefs,
			);
			if ("error" in resolved) rowErrors.push(resolved.error);
			else resolvedCategory = resolved.id;
		}

		if (!["deposit", "withdrawal"].includes(row.type)) {
			rowErrors.push('type must be "deposit" or "withdrawal"');
		}

		if (!["pending", "completed", "cancelled"].includes(row.status)) {
			rowErrors.push('status must be "pending", "completed", or "cancelled"');
		}

		let parsedCreatedAt: Date | null = null;
		if (row.createdAt) {
			parsedCreatedAt = new Date(row.createdAt);
			if (Number.isNaN(parsedCreatedAt.getTime())) {
				rowErrors.push("createdAt must be a valid date string if provided");
				parsedCreatedAt = null;
			}
		}

		if (rowErrors.length > 0) {
			errors.push({ row: rowNum, errors: rowErrors });
		} else {
			validRows.push({
				name: String(row.name).trim(),
				date: txDate as Date,
				remarks: row.remarks?.trim() || null,
				amount: amount.toFixed(2),
				paidByUserId: resolvedPaidBy as string,
				type: row.type as "deposit" | "withdrawal",
				status: row.status as "pending" | "completed" | "cancelled",
				categoryId: resolvedCategory,
				transactionGroupId: row.transactionGroupId?.trim() || null,
				createdAt: parsedCreatedAt,
				createdByUserId: resolvedCreatedBy,
			});
		}
	});

	return { validRows, errors };
}

export const POST: APIRoute = async ({ locals, request }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (sessionUser.role !== "admin") {
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	const contentType = request.headers.get("content-type") ?? "";
	let rawRows: ImportRow[];

	if (contentType.includes("application/json")) {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return Response.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		if (!Array.isArray(body)) {
			return Response.json(
				{ error: "JSON body must be an array of transaction rows" },
				{ status: 400 },
			);
		}

		rawRows = body as ImportRow[];
	} else if (
		contentType.includes("text/csv") ||
		contentType.includes("multipart/form-data")
	) {
		let csvText: string;

		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			const file = formData.get("file");
			if (!file || typeof file === "string") {
				return Response.json(
					{ error: 'multipart/form-data must include a "file" field' },
					{ status: 400 },
				);
			}
			csvText = await (file as File).text();
		} else {
			csvText = await request.text();
		}

		rawRows = parseCsv(csvText) as unknown as ImportRow[];
	} else {
		return Response.json(
			{
				error:
					"Content-Type must be application/json, text/csv, or multipart/form-data",
			},
			{ status: 415 },
		);
	}

	if (rawRows.length === 0) {
		return Response.json({ error: "No rows provided" }, { status: 400 });
	}

	// Load known users/categories so id-or-name references can be resolved to
	// real UUIDs before insertion.
	const { users, categories } = await fetchUsersAndCategories();
	const lookups: Lookups = {
		userRefs: users.map((u) => ({ id: u.id, label: u.name })),
		categoryRefs: categories.map((c) => ({ id: c.id, label: c.label })),
	};

	const { validRows, errors } = validateRows(rawRows, lookups);

	// Reject entire import if any row has errors
	if (errors.length > 0) {
		return Response.json(
			{ error: "Validation failed", rowErrors: errors },
			{ status: 422 },
		);
	}

	const now = new Date();

	await db.transaction(async (tx) => {
		for (const row of validRows) {
			await tx.insert(transactions).values({
				id: crypto.randomUUID(),
				transactionGroupId: row.transactionGroupId,
				name: row.name,
				date: row.date,
				remarks: row.remarks,
				amount: row.amount,
				type: row.type,
				status: row.status,
				paidByUserId: row.paidByUserId,
				categoryId: row.categoryId,
				createdByUserId: row.createdByUserId ?? sessionUser.id,
				createdAt: row.createdAt ?? now,
				updatedAt: now,
			});
		}
	});

	// Recalculate balances for all users affected by completed imports
	const completedRows = validRows.filter((r) => r.status === "completed");
	if (completedRows.length > 0) {
		const affectedUserIds = [
			...new Set(completedRows.map((r) => r.paidByUserId)),
		];
		await recalculateBalances(affectedUserIds);
	}

	return Response.json({ imported: validRows.length }, { status: 201 });
};

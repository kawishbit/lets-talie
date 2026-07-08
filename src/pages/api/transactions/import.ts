import { db } from "@db/database";
import { transactions } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import type { APIRoute } from "astro";

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
}

interface RowError {
	row: number;
	errors: string[];
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2) return [];

	const headers = lines[0]
		.split(",")
		.map((h) => h.trim().replace(/^"|"$/g, ""));

	return lines.slice(1).map((line) => {
		const values = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? [];
		const record: Record<string, string> = {};
		headers.forEach((h, i) => {
			record[h] = (values[i] ?? "").trim().replace(/^"|"$/g, "");
		});
		return record;
	});
}

function validateRows(rows: ImportRow[]): {
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

		if (!row.paidByUserId || String(row.paidByUserId).trim().length === 0) {
			rowErrors.push("paidByUserId is required");
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
				paidByUserId: String(row.paidByUserId).trim(),
				type: row.type as "deposit" | "withdrawal",
				status: row.status as "pending" | "completed" | "cancelled",
				categoryId: row.categoryId?.trim() || null,
				transactionGroupId: row.transactionGroupId?.trim() || null,
				createdAt: parsedCreatedAt,
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

	const { validRows, errors } = validateRows(rawRows);

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
				createdByUserId: sessionUser.id,
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

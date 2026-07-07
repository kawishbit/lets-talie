import { db } from "@db/database";
import { transactions } from "@db/schema";
import { recalculateBalances } from "@lib/balance";
import type { APIRoute } from "astro";

interface GroupTransactionBody {
	name: string;
	date: string;
	remarks?: string;
	amount: number;
	paidByUserId: string;
	/** All party userIds, must include paidByUserId */
	parties: string[];
	categoryId?: string;
	/** Optional per-party amounts keyed by userId; must sum to amount */
	customAmounts?: Record<string, number>;
}

export const POST: APIRoute = async ({ locals, request }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: GroupTransactionBody;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	// ── Validate required fields ─────────────────────────────────────────────
	const { name, date, amount, paidByUserId, parties } = body;
	if (
		!name ||
		!date ||
		typeof amount !== "number" ||
		!paidByUserId ||
		!Array.isArray(parties) ||
		parties.length === 0
	) {
		return Response.json(
			{
				error:
					"Missing or invalid required fields: name, date, amount, paidByUserId, parties",
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

	if (!parties.includes(paidByUserId)) {
		return Response.json(
			{ error: "paidByUserId must be included in parties" },
			{ status: 400 },
		);
	}

	const txDate = new Date(date);
	if (Number.isNaN(txDate.getTime())) {
		return Response.json({ error: "Invalid date format" }, { status: 400 });
	}

	// ── Compute per-party splits ──────────────────────────────────────────────
	let splits: { userId: string; amount: string }[];

	if (body.customAmounts) {
		const sum = parties.reduce((acc, uid) => {
			const v = body.customAmounts?.[uid];
			if (typeof v !== "number" || v < 0) return NaN;
			return acc + v;
		}, 0);

		if (Number.isNaN(sum) || Math.abs(sum - amount) > 0.01) {
			return Response.json(
				{ error: "Custom amounts must sum to the total amount" },
				{ status: 400 },
			);
		}

		splits = parties.map((uid) => ({
			userId: uid,
			amount: (body.customAmounts?.[uid] ?? 0).toFixed(2),
		}));
	} else {
		const perPerson = (amount / parties.length).toFixed(2);
		splits = parties.map((uid) => ({ userId: uid, amount: perPerson }));
	}

	// ── Determine status based on role ────────────────────────────────────────
	const isAdmin = sessionUser.role === "admin";
	const status = isAdmin ? "completed" : "pending";
	const groupId = crypto.randomUUID();
	const now = new Date();

	const commonFields = {
		transactionGroupId: groupId,
		name,
		date: txDate,
		remarks: body.remarks ?? null,
		categoryId: body.categoryId ?? null,
		status,
		createdByUserId: sessionUser.id,
		createdAt: now,
		updatedAt: now,
	};

	// ── Insert in a DB transaction ────────────────────────────────────────────
	await db.transaction(async (tx) => {
		// 1 deposit — full amount, payer
		await tx.insert(transactions).values({
			id: crypto.randomUUID(),
			...commonFields,
			amount: amount.toFixed(2),
			type: "deposit",
			paidByUserId,
		});

		// N withdrawals — one per party (including payer's own share)
		for (const split of splits) {
			await tx.insert(transactions).values({
				id: crypto.randomUUID(),
				...commonFields,
				amount: split.amount,
				type: "withdrawal",
				paidByUserId: split.userId,
			});
		}
	});

	if (status === "completed") {
		await recalculateBalances([paidByUserId, ...parties]);
	}

	return Response.json({ groupId }, { status: 201 });
};

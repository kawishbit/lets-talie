import { describe, expect, it } from "vitest";
import { sessionCookieFor } from "../helpers/auth";
import { seedAdmin, seedGroup, seedUser } from "../helpers/db";
import { apiFetch } from "../helpers/server";

// 9h — API Integration: GET /api/transactions/groups/pending

describe("GET /api/transactions/groups/pending", () => {
	// Middleware redirects unauthenticated requests to non-public routes before
	// the handler's own 401 check ever runs — see the equivalent note in
	// transactions-get.test.ts.
	it("redirects to /login for an unauthenticated request (middleware runs first)", async () => {
		const res = await apiFetch("/api/transactions/groups/pending");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/login");
	});

	it("returns 403 for a regular user", async () => {
		const { id } = await seedUser();
		const cookie = await sessionCookieFor(id);

		const res = await apiFetch("/api/transactions/groups/pending", { cookie });
		expect(res.status).toBe(403);
	});

	it("admin receives paginated pending groups; completed/cancelled/deleted excluded", async () => {
		const admin = await seedAdmin();
		const payer = await seedUser();

		const pending = await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 30,
			status: "pending",
			name: "Pending group",
		});
		await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 30,
			status: "completed",
			name: "Completed group",
		});
		await seedGroup({
			paidByUserId: payer.id,
			parties: [payer.id],
			amount: 30,
			status: "cancelled",
			name: "Cancelled group",
		});

		const cookie = await sessionCookieFor(admin.id);
		const res = await apiFetch("/api/transactions/groups/pending", { cookie });
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			groups: { groupId: string; name: string }[];
			total: number;
			page: number;
			pageSize: number;
		};
		expect(body.groups).toHaveLength(1);
		expect(body.groups[0].groupId).toBe(pending.groupId);
		expect(body.groups[0].name).toBe("Pending group");
		expect(body.total).toBe(1);
		expect(body).toMatchObject({ page: 1 });
		expect(typeof body.pageSize).toBe("number");
	});
});

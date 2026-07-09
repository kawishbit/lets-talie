// @vitest-environment node
import { db } from "@db/database";
import { DELETE, PATCH } from "@pages/api/categories/[id]";
import { GET, POST } from "@pages/api/categories/index";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../helpers/db";

const mockDb = vi.mocked(db);

function makeLocals(user: { id: string; role: string } | null) {
	return { user, session: null } as never;
}

function jsonRequest(body: unknown) {
	return new Request("http://localhost/api/categories", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/categories", () => {
	it("returns a paginated list excluding soft-deleted rows", async () => {
		const items = [{ id: "c1", label: "Food" }];
		mockDb.select
			.mockReturnValueOnce(createChain(items) as never)
			.mockReturnValueOnce(createChain([{ total: 1 }]) as never);

		const res = await GET({
			locals: makeLocals({ id: "u1", role: "user" }),
			url: new URL("http://localhost/api/categories"),
		} as never);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ items, total: 1, page: 1, pageSize: 20 });
	});

	it("returns 401 when no session exists", async () => {
		const res = await GET({
			locals: makeLocals(null),
			url: new URL("http://localhost/api/categories"),
		} as never);
		expect(res.status).toBe(401);
	});
});

describe("POST /api/categories", () => {
	it("returns 403 when not admin", async () => {
		const res = await POST({
			locals: makeLocals({ id: "u1", role: "user" }),
			request: jsonRequest({ label: "Food" }),
		} as never);
		expect(res.status).toBe(403);
	});

	it("returns 400 when label is missing", async () => {
		const res = await POST({
			locals: makeLocals({ id: "u1", role: "admin" }),
			request: jsonRequest({}),
		} as never);
		expect(res.status).toBe(400);
	});

	it("inserts and returns 201 on valid input", async () => {
		mockDb.insert.mockReturnValue(createChain(undefined) as never);
		const res = await POST({
			locals: makeLocals({ id: "u1", role: "admin" }),
			request: jsonRequest({ label: "Food" }),
		} as never);
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toHaveProperty("id");
	});
});

describe("PATCH /api/categories/[id]", () => {
	function ctx(
		user: { id: string; role: string } | null,
		body: unknown,
		id = "c1",
	) {
		return {
			locals: makeLocals(user),
			request: new Request(`http://localhost/api/categories/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			}),
			params: { id },
		} as never;
	}

	it("returns 403 when not admin", async () => {
		const res = await PATCH(ctx({ id: "u1", role: "user" }, { label: "X" }));
		expect(res.status).toBe(403);
	});

	it("returns 404 when id does not exist", async () => {
		mockDb.update.mockReturnValue(createChain([]) as never);
		const res = await PATCH(ctx({ id: "u1", role: "admin" }, { label: "X" }));
		expect(res.status).toBe(404);
	});

	it("updates and returns 200 on valid input", async () => {
		mockDb.update.mockReturnValue(createChain([{ id: "c1" }]) as never);
		const res = await PATCH(
			ctx({ id: "u1", role: "admin" }, { label: "Groceries" }),
		);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ id: "c1" });
	});
});

describe("DELETE /api/categories/[id]", () => {
	function ctx(user: { id: string; role: string } | null, id = "c1") {
		return { locals: makeLocals(user), params: { id } } as never;
	}

	it("returns 403 when not admin", async () => {
		const res = await DELETE(ctx({ id: "u1", role: "user" }));
		expect(res.status).toBe(403);
	});

	it("returns 404 when id does not exist", async () => {
		mockDb.update.mockReturnValue(createChain([]) as never);
		const res = await DELETE(ctx({ id: "u1", role: "admin" }));
		expect(res.status).toBe(404);
	});

	it("soft-deletes (sets deletedAt) and returns 200", async () => {
		const updateChain = createChain([{ id: "c1" }]);
		mockDb.update.mockReturnValue(updateChain as never);

		const res = await DELETE(ctx({ id: "u1", role: "admin" }));

		expect(res.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ deletedAt: expect.any(Date) }),
		);
	});
});

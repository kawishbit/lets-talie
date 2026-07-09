// @vitest-environment node
import { db } from "@db/database";
import { DELETE, PATCH } from "@pages/api/users/[id]";
import { GET, POST } from "@pages/api/users/index";
import { describe, expect, it, vi } from "vitest";
import { createChain } from "../helpers/db";

const mockDb = vi.mocked(db);

function makeLocals(user: { id: string; role: string } | null) {
	return { user, session: null } as never;
}

function jsonRequest(url: string, method: string, body: unknown) {
	return new Request(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/users", () => {
	it("returns 403 when not admin", async () => {
		const res = await GET({
			locals: makeLocals({ id: "u1", role: "user" }),
			url: new URL("http://localhost/api/users"),
		} as never);
		expect(res.status).toBe(403);
	});

	it("returns a paginated list excluding soft-deleted rows", async () => {
		const items = [{ id: "u1", name: "Alice" }];
		mockDb.select
			.mockReturnValueOnce(createChain(items) as never)
			.mockReturnValueOnce(createChain([{ total: 1 }]) as never);

		const res = await GET({
			locals: makeLocals({ id: "admin", role: "admin" }),
			url: new URL("http://localhost/api/users"),
		} as never);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ items, total: 1, page: 1, pageSize: 20 });
	});

	it("filters by role when ?role=admin is provided", async () => {
		const selectChain = createChain([]);
		mockDb.select
			.mockReturnValueOnce(selectChain as never)
			.mockReturnValueOnce(createChain([{ total: 0 }]) as never);

		await GET({
			locals: makeLocals({ id: "admin", role: "admin" }),
			url: new URL("http://localhost/api/users?role=admin"),
		} as never);

		expect(selectChain.where).toHaveBeenCalledTimes(1);
	});
});

describe("POST /api/users", () => {
	it("returns 403 when not admin", async () => {
		const res = await POST({
			locals: makeLocals({ id: "u1", role: "user" }),
			request: jsonRequest("http://localhost/api/users", "POST", {
				name: "Bob",
				email: "bob@example.com",
			}),
		} as never);
		expect(res.status).toBe(403);
	});

	it("returns 400 when email or name is missing", async () => {
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest("http://localhost/api/users", "POST", {
				name: "Bob",
			}),
		} as never);
		expect(res.status).toBe(400);
	});

	it("inserts and returns 201 on valid input", async () => {
		mockDb.insert.mockReturnValue(createChain(undefined) as never);
		const res = await POST({
			locals: makeLocals({ id: "admin", role: "admin" }),
			request: jsonRequest("http://localhost/api/users", "POST", {
				name: "Bob",
				email: "bob@example.com",
			}),
		} as never);
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toHaveProperty("id");
	});
});

describe("PATCH /api/users/[id]", () => {
	function ctx(
		user: { id: string; role: string } | null,
		body: unknown,
		id = "u2",
	) {
		return {
			locals: makeLocals(user),
			request: jsonRequest(`http://localhost/api/users/${id}`, "PATCH", body),
			params: { id },
		} as never;
	}

	it("returns 403 when not admin", async () => {
		const res = await PATCH(ctx({ id: "u1", role: "user" }, { name: "X" }));
		expect(res.status).toBe(403);
	});

	it("returns 404 when id does not exist", async () => {
		mockDb.update.mockReturnValue(createChain([]) as never);
		const res = await PATCH(ctx({ id: "admin", role: "admin" }, { name: "X" }));
		expect(res.status).toBe(404);
	});

	it("updates and returns 200 on valid input", async () => {
		mockDb.update.mockReturnValue(createChain([{ id: "u2" }]) as never);
		const res = await PATCH(
			ctx({ id: "admin", role: "admin" }, { role: "admin" }),
		);
		expect(res.status).toBe(200);
	});
});

describe("DELETE /api/users/[id]", () => {
	function ctx(user: { id: string; role: string } | null, id = "u2") {
		return { locals: makeLocals(user), params: { id } } as never;
	}

	it("returns 403 when not admin", async () => {
		const res = await DELETE(ctx({ id: "u1", role: "user" }));
		expect(res.status).toBe(403);
	});

	it("returns 400 when attempting to delete own account", async () => {
		const res = await DELETE(ctx({ id: "admin", role: "admin" }, "admin"));
		expect(res.status).toBe(400);
	});

	it("returns 404 when id does not exist", async () => {
		mockDb.update.mockReturnValue(createChain([]) as never);
		const res = await DELETE(ctx({ id: "admin", role: "admin" }));
		expect(res.status).toBe(404);
	});

	it("soft-deletes (sets deletedAt) and returns 200", async () => {
		const updateChain = createChain([{ id: "u2" }]);
		mockDb.update.mockReturnValue(updateChain as never);

		const res = await DELETE(ctx({ id: "admin", role: "admin" }));

		expect(res.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ deletedAt: expect.any(Date) }),
		);
	});
});

import { fetchPendingEntries } from "@lib/queries";
import type { APIRoute } from "astro";

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

	const { entries, total } = await fetchPendingEntries(page, pageSize);

	return Response.json({ groups: entries, total, page, pageSize });
};

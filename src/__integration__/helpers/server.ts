const TEST_APP_PORT = process.env.TEST_APP_PORT ?? "30099";
export const BASE_URL = `http://localhost:${TEST_APP_PORT}`;

type FetchOptions = {
	method?: string;
	body?: unknown;
	cookie?: string;
	headers?: Record<string, string>;
};

/** Thin `fetch` wrapper against the live test server, with cookie injection. */
export async function apiFetch(
	path: string,
	opts: FetchOptions = {},
): Promise<Response> {
	// better-auth requires an Origin/Referer header on cookie-authenticated
	// requests (CSRF protection) — a real browser always sends one for
	// same-origin requests, so mirror that here rather than disabling the check.
	const headers: Record<string, string> = { origin: BASE_URL, ...opts.headers };
	if (opts.cookie) headers.cookie = opts.cookie;

	const method = opts.method ?? "GET";
	let body: BodyInit | undefined;
	if (opts.body instanceof FormData) {
		body = opts.body;
	} else if (typeof opts.body === "string") {
		body = opts.body;
		headers["content-type"] ??= "text/csv";
	} else if (opts.body !== undefined) {
		body = JSON.stringify(opts.body);
		headers["content-type"] ??= "application/json";
	} else if (method !== "GET" && method !== "HEAD") {
		// better-call requires a content-type even on bodiless POSTs (e.g. sign-out).
		body = "{}";
		headers["content-type"] ??= "application/json";
	}

	return fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		body,
		// Assert on redirect status/Location directly rather than following.
		redirect: "manual",
	});
}

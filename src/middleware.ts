import { defineMiddleware } from "astro:middleware";
import { auth } from "@lib/auth";

const PUBLIC_ROUTES = new Set(["/", "/login"]);
const AUTH_API_PREFIX = "/api/auth";
const ADMIN_ROUTES = [
	"/users",
	"/transaction-categories",
	"/import-transactions",
	"/approve-transactions",
];
const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	// Demo mode: block every mutating request to the API, regardless of auth
	// state — this is enforced here (not just hidden in the UI) since the
	// demo is publicly reachable.
	if (
		import.meta.env.PUBLIC_DEMO_MODE === "true" &&
		pathname.startsWith("/api/") &&
		!pathname.startsWith(AUTH_API_PREFIX) &&
		MUTATING_METHODS.has(context.request.method)
	) {
		return Response.json(
			{ error: "Demo mode: this action is disabled." },
			{ status: 403 },
		);
	}

	const session = await auth.api.getSession({
		headers: context.request.headers,
	});

	context.locals.user = session?.user
		? {
				...session.user,
				role: session.user.role ?? null,
				accountBalance: session.user.accountBalance ?? null,
			}
		: null;
	context.locals.session = session?.session ?? null;

	// Always allow public routes and auth API
	if (PUBLIC_ROUTES.has(pathname) || pathname.startsWith(AUTH_API_PREFIX)) {
		return next();
	}

	// Redirect unauthenticated users to /login
	if (!session) {
		return context.redirect("/login");
	}

	// Redirect non-admins away from admin-only routes
	const isAdminRoute = ADMIN_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);
	if (isAdminRoute && session.user.role !== "admin") {
		return context.redirect("/dashboard");
	}

	return next();
});

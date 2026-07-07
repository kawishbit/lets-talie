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

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

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

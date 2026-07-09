import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

type DemoLoginOptions = {
	enabled: boolean;
	userEmail?: string;
};

/**
 * Registers POST /demo-login (resolves to /api/auth/demo-login via the
 * better-auth catch-all route). Only responds when demo mode is enabled —
 * otherwise 404s, same as a route that doesn't exist.
 */
const demoLogin = (options: DemoLoginOptions) => {
	return {
		id: "demo-login",
		endpoints: {
			demoLogin: createAuthEndpoint(
				"/demo-login",
				{ method: "POST" },
				async (ctx) => {
					if (!options.enabled || !options.userEmail) {
						throw new APIError("NOT_FOUND");
					}

					const found = await ctx.context.internalAdapter.findUserByEmail(
						options.userEmail,
					);
					if (!found) {
						throw new APIError("NOT_FOUND", {
							message: "Demo user is not seeded. Run `bun run seed:demo`.",
						});
					}

					const session = await ctx.context.internalAdapter.createSession(
						found.user.id,
					);
					if (!session) {
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Failed to create demo session",
						});
					}

					await setSessionCookie(ctx, { session, user: found.user });

					return ctx.json({ success: true });
				},
			),
		},
	} satisfies BetterAuthPlugin;
};

export { demoLogin };

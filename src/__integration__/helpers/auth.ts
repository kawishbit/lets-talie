/**
 * Creates a real session by inserting directly into the `session` table
 * (rather than going through a sign-in endpoint) and signs the cookie the
 * same way better-auth does, so `auth.api.getSession()` on the live test
 * server accepts it. Signing scheme mirrors better-call's
 * `serializeSignedCookie`: HMAC-SHA256(secret, token), base64, appended as
 * `${token}.${signature}`.
 */
import { db } from "@db/database";
import { session } from "@db/schema";

const COOKIE_NAME = "better-auth.session_token";

async function signToken(token: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signatureBuf = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(token),
	);
	const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuf)));
	return `${token}.${signature}`;
}

/** Returns a `Cookie` header string authenticating as the given userId. */
export async function sessionCookieFor(userId: string): Promise<string> {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error(
			"BETTER_AUTH_SECRET must be set to sign test session cookies",
		);
	}

	const token = crypto.randomUUID();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

	await db.insert(session).values({
		id: crypto.randomUUID(),
		token,
		userId,
		expiresAt,
		createdAt: now,
		updatedAt: now,
	});

	const signedValue = await signToken(token, secret);
	return `${COOKIE_NAME}=${encodeURIComponent(signedValue)}`;
}

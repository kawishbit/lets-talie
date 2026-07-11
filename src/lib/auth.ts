import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@db/database";
import * as schema from "@db/schema";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { demoLogin } from "./demo-auth";
import { renderPasswordlessEmail } from "./emails";
import { sendMail } from "./mailer";
import { passwordlessBundle } from "./passwordless";

const demoModeEnabled = process.env.PUBLIC_DEMO_MODE === "true";

export const auth = betterAuth({
	appName: "lets-talie",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	// Emit UUIDs for id columns so they match the native `uuid` type in the schema.
	// NB: must be a function, not the "uuid" string. With the Drizzle adapter
	// (supportsUUIDs = true), `generateId: "uuid"` makes Better Auth omit the id
	// and expect the DB to default it — but our uuid PKs have no default, so
	// inserts fail with a NOT NULL violation. A function forces Better Auth to
	// generate the id in code, matching how the app tables create ids.
	advanced: {
		database: {
			generateId: () => crypto.randomUUID(),
		},
	},
	user: {
		additionalFields: {
			accountBalance: {
				type: "string",
				defaultValue: "0.00",
			},
		},
	},
	plugins: [
		admin(),
		demoLogin({
			enabled: demoModeEnabled,
			userEmail: process.env.DEMO_USER_EMAIL,
		}),
		passwordlessBundle({
			disableSignUp: true,
			sendEmail: async ({
				to,
				otp,
				magicLinkUrl,
				expiresInSeconds,
				appName,
			}) => {
				await sendMail({
					to,
					subject: `Sign in to ${appName}`,
					html: renderPasswordlessEmail({
						otp,
						magicLinkUrl,
						expiresInSeconds,
						appName,
					}),
				});
			},
		}),
	],
});

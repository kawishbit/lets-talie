import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@db/database";
import * as schema from "@db/schema";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { demoLogin } from "./demo-auth";
import { sendMail } from "./mailer";
import { passwordlessBundle } from "./passwordless";

const demoModeEnabled = process.env.PUBLIC_DEMO_MODE === "true";

export const auth = betterAuth({
	appName: "lets-talie",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
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
					html: `
						<p>Your login code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
						<p>Or <a href="${magicLinkUrl}">click here</a> to sign in directly.</p>
						<p>Expires in ${Math.round(expiresInSeconds / 60)} minutes.</p>
					`,
				});
			},
		}),
	],
});

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@db/database";
import * as schema from "@db/schema";
import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import { Resend } from "resend";

const resend = new Resend(Bun.env.RESEND_API_KEY);

export const auth = betterAuth({
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
		magicLink({
			disableSignUp: true,
			sendMagicLink: async ({ email, url }) => {
				await resend.emails.send({
					from: "lets-talie <noreply@letstalie.kawishbit.com>",
					to: email,
					subject: "Sign in to lets-talie",
					html: `<p>Click <a href="${url}">here</a> to sign in to lets-talie. This link expires in 10 minutes.</p>`,
				});
			},
		}),
	],
});

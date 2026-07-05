import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@db/database";

export const auth = betterAuth({
        database: drizzleAdapter(db, {
                provider: "pg",
        }),
        user: {
                additionalFields: {
                        role: {
                                type: "string",
                                defaultValue: "user",
                        },
                        accountBalance: {
                                type: "string",
                                defaultValue: "0.00",
                        },
                },
        },
        plugins: [
                magicLink({
                        sendMagicLink: async ({ email, token, url, metadata }, ctx) => {
                                // send email to user
                        }
                })
        ]
});
/// <reference path="../.astro/types.d.ts" />

declare namespace App {
	// Note: 'import {} from ""' syntax does not work in .d.ts files.
	interface Locals {
		user: {
			id: string;
			name: string;
			email: string;
			emailVerified: boolean;
			image?: string | null;
			createdAt: Date;
			updatedAt: Date;
			role: string | null;
			accountBalance: string | null;
		} | null;
		session: import("better-auth").Session | null;
	}
}

interface ImportMetaEnv {
	readonly DATABASE_URL: string;
	readonly BETTER_AUTH_SECRET: string;
	readonly BETTER_AUTH_URL: string;
	readonly SMTP_HOST: string;
	readonly SMTP_PORT: string;
	readonly SMTP_SECURE: string;
	readonly SMTP_USER: string;
	readonly SMTP_PASS: string;
	readonly SMTP_FROM: string;
	readonly PUBLIC_CURRENCY_CODE: string;
}

declare global {
	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}

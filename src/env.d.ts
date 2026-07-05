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
	readonly RESEND_API_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

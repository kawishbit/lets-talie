import { adminClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";

export const authClient = createAuthClient({
	plugins: [adminClient(), magicLinkClient()],
});

export const { signIn, signOut } = authClient;

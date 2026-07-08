import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";
import { passwordlessBundleClient } from "./passwordless";

export const authClient = createAuthClient({
	plugins: [adminClient(), passwordlessBundleClient()],
});

export const { signOut } = authClient;

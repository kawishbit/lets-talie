import { beforeEach } from "vitest";
import { resetDb } from "./helpers/db";
import { clearInbox } from "./helpers/mail";

beforeEach(async () => {
	await resetDb();
	await clearInbox();
});

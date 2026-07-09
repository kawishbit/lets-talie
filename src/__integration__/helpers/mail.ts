/**
 * Reads back real emails the app sends during auth-flow tests via Mailpit's
 * HTTP API (see docker-compose.yml `mailpit-test` service), instead of
 * mocking `sendMail`. This exercises the actual SMTP path end-to-end.
 */
const MAILPIT_URL = `http://localhost:${process.env.MAILPIT_TEST_HTTP_PORT ?? "8026"}`;

const OTP_REGEX = /font-size:24px;letter-spacing:4px">(\d+)</;
const MAGIC_LINK_REGEX = /href="([^"]+passwordless-bundle\/verify\?[^"]+)"/;

export async function clearInbox(): Promise<void> {
	await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

interface MailpitSearchHit {
	ID: string;
}

async function findLatestMessageId(toEmail: string): Promise<string | null> {
	const res = await fetch(
		`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${toEmail}`)}`,
	);
	const data = (await res.json()) as { messages: MailpitSearchHit[] };
	return data.messages[0]?.ID ?? null;
}

async function fetchHtmlBody(messageId: string): Promise<string> {
	const res = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
	const data = (await res.json()) as { HTML: string };
	return data.HTML;
}

/** Polls Mailpit for the latest email to `toEmail` and pulls out the OTP + magic-link URL. */
export async function waitForLoginEmail(
	toEmail: string,
	{ timeoutMs = 5000 }: { timeoutMs?: number } = {},
): Promise<{ otp: string; magicLinkUrl: string }> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const messageId = await findLatestMessageId(toEmail);
		if (messageId) {
			const html = await fetchHtmlBody(messageId);
			const otpMatch = html.match(OTP_REGEX);
			const linkMatch = html.match(MAGIC_LINK_REGEX);
			if (otpMatch && linkMatch) {
				return { otp: otpMatch[1], magicLinkUrl: linkMatch[1] };
			}
		}
		await new Promise((r) => setTimeout(r, 150));
	}

	throw new Error(`Timed out waiting for login email to ${toEmail}`);
}

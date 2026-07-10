/**
 * Classifies SMTP errors so login (which sends an OTP/magic-link email) can
 * show a clear, actionable message instead of a raw ECONNREFUSED dump.
 */
export function describeMailError(err: unknown): string {
	const code = (err as { code?: string } | undefined)?.code;

	if (
		code === "ESOCKET" ||
		code === "ECONNECTION" ||
		code === "ECONNREFUSED" ||
		code === "ENOTFOUND" ||
		code === "ETIMEDOUT"
	) {
		return (
			"Could not connect to the mail server. Make sure your SMTP server is " +
			"running and SMTP_HOST/SMTP_PORT in your .env are correct."
		);
	}

	if (code === "EAUTH") {
		return "SMTP authentication failed. Check SMTP_USER and SMTP_PASS in your .env.";
	}

	return "Failed to send email. Check the server logs and your SMTP configuration in .env.";
}

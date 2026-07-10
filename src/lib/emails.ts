type PasswordlessEmailOptions = {
	otp: string;
	magicLinkUrl: string;
	expiresInSeconds: number;
	appName: string;
};

export function renderPasswordlessEmail({
	otp,
	magicLinkUrl,
	expiresInSeconds,
	appName,
}: PasswordlessEmailOptions) {
	const minutes = Math.round(expiresInSeconds / 60);

	return `
		<div style="background:#f5f5f5;padding:32px 16px;font-family:Inter,-apple-system,system-ui,sans-serif;">
			<table role="presentation" width="100%" style="max-width:420px;margin:0 auto;border-collapse:collapse;">
				<tr>
					<td style="padding-bottom:24px;">
						<span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:12px;letter-spacing:0.6px;text-transform:uppercase;color:#737373;">${escapeHtml(appName)}</span>
					</td>
				</tr>
				<tr>
					<td style="background:#ffffff;border-radius:24px;padding:40px 32px;">
						<p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0a0a0a;">Sign in</p>
						<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#525252;">Use this code, or the link below, to finish signing in.</p>

						<div style="background:#e4f5d4;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
							<span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:32px;font-weight:500;letter-spacing:8px;color:#0a0a0a;">${escapeHtml(otp)}</span>
						</div>

						<a href="${escapeAttr(magicLinkUrl)}" style="display:block;text-align:center;background:#0a0a0a;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;border-radius:9999px;padding:12px 24px;">Sign in with one click</a>

						<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#a3a3a3;">This code and link expire in ${minutes} minute${minutes === 1 ? "" : "s"}. If you didn't request this, you can ignore this email.</p>
					</td>
				</tr>
			</table>
		</div>
	`;
}

function escapeHtml(value: string) {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			(
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				}) as Record<string, string>
			)[char] as string,
	);
}

function escapeAttr(value: string) {
	return escapeHtml(value);
}

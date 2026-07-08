import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
	host: Bun.env.SMTP_HOST,
	port: Number(Bun.env.SMTP_PORT ?? 587),
	secure: Bun.env.SMTP_SECURE === "true",
	auth: {
		user: Bun.env.SMTP_USER,
		pass: Bun.env.SMTP_PASS,
	},
});

export async function sendMail(options: {
	to: string;
	subject: string;
	html: string;
}) {
	await transporter.sendMail({
		from: Bun.env.SMTP_FROM,
		...options,
	});
}

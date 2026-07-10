import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT ?? 587),
	secure: process.env.SMTP_SECURE === "true",
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

export async function sendMail(options: {
	to: string;
	subject: string;
	html: string;
}) {
	await transporter.sendMail({
		from: process.env.SMTP_FROM,
		...options,
	});
}

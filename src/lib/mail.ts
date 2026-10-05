import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Email through any SMTP provider (Mailjet, Brevo, Gmail…), set in .env:
//   SMTP_HOST, SMTP_PORT (587 = STARTTLS, 465 = TLS), SMTP_USER, SMTP_PASS, MAIL_FROM
// and APP_URL for the links. Without SMTP_HOST, email features simply stay off.

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}

/** Public address of the site, for links in emails (no trailing slash). */
export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

let transporter: Transporter | null = null;
function getTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

export type Mail = { to: string; subject: string; html: string; text: string };

/** Sends one email. Throws when the provider refuses it (callers decide what to do). */
export async function sendMail(mail: Mail) {
  if (!mailConfigured()) throw new Error("SMTP is not configured");
  await getTransporter().sendMail({ from: process.env.MAIL_FROM, ...mail });
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A simple, readable email: title, paragraphs, one button, and a footer line. */
export function emailLayout(opts: { siteName: string; title: string; paragraphs: string[]; button?: { label: string; url: string }; footer: string }) {
  const { siteName, title, paragraphs, button, footer } = opts;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#2b2622">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#d9480f;text-transform:uppercase">${escape(siteName)}</td></tr>
<tr><td style="padding-top:12px;font-size:22px;font-weight:bold">${escape(title)}</td></tr>
${paragraphs.map((p) => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5">${escape(p)}</td></tr>`).join("")}
${
  button
    ? `<tr><td style="padding-top:22px"><a href="${escape(button.url)}" style="display:inline-block;background:#d9480f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${escape(button.label)}</a></td></tr>
<tr><td style="padding-top:12px;font-size:12px;color:#7a716a;word-break:break-all">${escape(button.url)}</td></tr>`
    : ""
}
<tr><td style="padding-top:24px;border-top:1px solid #eee;margin-top:24px;font-size:12px;color:#7a716a">${escape(footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [siteName, "", title, "", ...paragraphs, ...(button ? ["", `${button.label} : ${button.url}`] : []), "", footer].join("\n");
  return { html, text };
}

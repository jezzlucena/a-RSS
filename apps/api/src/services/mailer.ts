import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_URL) return null;
  transporter = nodemailer.createTransport(env.SMTP_URL);
  return transporter;
}

export async function sendMagicLinkEmail(to: string, magicUrl: string): Promise<void> {
  const t = getTransporter();
  const subject = 'Your a-RSS sign-in link';
  const text = `Sign in to a-RSS:\n\n${magicUrl}\n\nThis link is valid for 15 minutes and can be used once.`;
  const html = `
    <p>Sign in to <strong>a-RSS</strong>:</p>
    <p><a href="${magicUrl}">Sign in</a></p>
    <p style="color:#666;font-size:12px">This link is valid for 15 minutes and can be used once.</p>
  `;
  if (!t) {
    // Dev fallback — surface the link in logs so you can sign in without SMTP.
    console.log(`[mailer:dev] magic link for ${to}: ${magicUrl}`);
    return;
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

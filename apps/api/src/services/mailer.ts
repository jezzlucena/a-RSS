import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_URL) return null;
  transporter = nodemailer.createTransport(env.SMTP_URL);
  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Newspaper-style palette mirrored from the web app's tailwind theme.
const COLORS = {
  paper: '#F4F1EA',
  ink: '#0E0E0C',
  muted: '#6E665A',
  rule: '#D6CFC1',
  vermilion: '#C9412B',
  vermilionDeep: '#9F2A19',
} as const;

// Web-safe stacks — brand fonts (Fraunces/JetBrains Mono) load only in clients that
// honor the <style> @import; everywhere else these fallbacks keep the aesthetic.
const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function renderMagicLinkHtml(magicUrl: string): string {
  const href = escapeHtml(magicUrl);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Your a-RSS sign-in link</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=JetBrains+Mono:wght@500&display=swap');
    body { margin: 0; padding: 0; background: ${COLORS.paper}; }
    a { text-decoration: none; }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.paper};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.paper};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${COLORS.paper};border:2px solid ${COLORS.ink};">
          <!-- Masthead -->
          <tr>
            <td style="padding:26px 32px 20px;border-bottom:2px solid ${COLORS.ink};">
              <div style="font-family:${SERIF};font-size:30px;font-weight:600;letter-spacing:-0.01em;color:${COLORS.ink};line-height:1;">
                a<span style="color:${COLORS.vermilion};font-style:italic;">—</span>RSS
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};">
                Sign-in link
              </div>
              <h1 style="margin:14px 0 0;font-family:${SERIF};font-size:26px;font-weight:600;line-height:1.15;letter-spacing:-0.01em;color:${COLORS.ink};">
                Your link to sign in
              </h1>
              <p style="margin:16px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${COLORS.ink};">
                Tap the button below to sign in to a-RSS. This link is valid for
                <strong>15 minutes</strong> and can be used once.
              </p>
              <!-- CTA (table+bgcolor for Outlook), sharp corners to match the app -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
                <tr>
                  <td bgcolor="${COLORS.ink}" style="background:${COLORS.ink};">
                    <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:${MONO};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.paper};">
                      Sign in&nbsp;&nbsp;&rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${COLORS.muted};">
                Or paste this URL into your browser:
              </p>
              <p style="margin:6px 0 0;font-family:${MONO};font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${href}" style="color:${COLORS.vermilionDeep};text-decoration:underline;">${href}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px;border-top:1px solid ${COLORS.rule};">
              <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.5;color:${COLORS.muted};">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <div style="max-width:480px;margin:16px auto 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};text-align:center;">
          a—RSS · Another RSS Software Solution
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderMagicLinkText(magicUrl: string): string {
  return [
    'Sign in to a-RSS',
    '',
    'Use the link below to sign in. It is valid for 15 minutes and can be used once.',
    '',
    magicUrl,
    '',
    "If you didn't request this email, you can safely ignore it.",
  ].join('\n');
}

export async function sendMagicLinkEmail(to: string, magicUrl: string): Promise<void> {
  const t = getTransporter();
  const subject = 'Your a-RSS sign-in link';
  const text = renderMagicLinkText(magicUrl);
  const html = renderMagicLinkHtml(magicUrl);
  if (!t) {
    // Dev fallback — surface the link in logs so you can sign in without SMTP.
    console.log(`[mailer:dev] magic link for ${to}: ${magicUrl}`);
    return;
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

import { config } from '../config';

// Sends the six-digit verification code. In dev (AUTH_DEV_CODES=true) or when
// no Resend key is configured, the code is logged to the console instead of
// emailed — so you can test the full auth flow before wiring real email.

const SUBJECT = 'Your SommSavvy code';

function textBody(code: string): string {
  return [
    `Your SommSavvy code is ${code}.`,
    '',
    'It expires in ten minutes. If you did not request it, you can ignore this email.',
  ].join('\n');
}

function htmlBody(code: string): string {
  return `<!doctype html><html><body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#14100D;color:#C9BFA8;padding:32px">
  <p style="font-size:15px;margin:0 0 16px">Your SommSavvy code</p>
  <p style="font-size:34px;letter-spacing:8px;font-weight:600;color:#F2E9D4;margin:0 0 16px">${code}</p>
  <p style="font-size:13px;color:#8A8069;margin:0">Expires in ten minutes. If you did not request it, ignore this email.</p>
</body></html>`;
}

export async function sendCodeEmail(email: string, code: string): Promise<void> {
  if (config.authDevCodes || !config.resendApiKey) {
    console.log(`[auth] email code for ${email}: ${code}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: SUBJECT,
      text: textBody(code),
      html: htmlBody(code),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
}

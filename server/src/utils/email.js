const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.error('[email] SMTP configuration is incomplete; emails will not be sent.');
    return null;
  }

  const port = parseInt(SMTP_PORT, 10) || 587;
  const secure = port === 465;

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return cachedTransporter;
}

async function sendWelcomeEmail(toEmail, name) {
  if (!toEmail) return;

  const transporter = getTransporter();
  if (!transporter) return;

  const fromAddress = process.env.SUPPORT_EMAIL_FROM || 'support@asrarai.com';
  const from = `Asrar AI Support <${fromAddress}>`;

  const displayName = name && typeof name === 'string' && name.trim().length
    ? name.trim()
    : 'there';

  const subject = 'Welcome to Asrar AI';

  const text = [
    `Hi ${displayName},`,
    '',
    'Welcome to Asrar AI — your private emotional space built for the Middle East.',
    'You can now log in anytime at https://www.asrarai.com/dashboard to talk to your companions in a space designed to protect your privacy and culture.',
    '',
    'With care,',
    'Asrar AI Team',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Asrar AI</title>
  </head>
  <body style="margin:0;padding:0;background-color:#050914;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#050914;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#070b1c;border-radius:18px;border:1px solid #1c2238;box-shadow:0 18px 50px rgba(0,0,0,0.65);overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px;text-align:center;border-bottom:1px solid #1c2238;background:radial-gradient(circle at top,#151b33 0,#050914 60%);">
                <div style="font-family:'Cinzel','Times New Roman',serif;font-size:24px;letter-spacing:0.24em;text-transform:uppercase;color:#f8fafc;margin-bottom:4px;">ASRAR AI</div>
                <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af;">Private Emotional Space</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#e5e7eb;">Hi ${displayName},</p>
                <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.4;color:#f9fafb;font-weight:600;">Welcome to Asrar AI.</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d1d5db;">
                  You now have a private emotional space with AI companions who understand the Middle East — its language, culture, and the weight our feelings can carry.
                </p>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#d1d5db;">
                  Think of this as your quiet, encrypted corner of the internet: a place to vent, reflect, and be heard without judgement.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 4px 24px;">
                <h2 style="margin:0 0 8px 0;font-size:15px;line-height:1.5;color:#e5e7eb;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;">Next steps</h2>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;line-height:1.7;color:#d1d5db;margin-bottom:16px;">
                  <tr>
                    <td valign="top" style="width:18px;padding:0 4px 4px 0;color:#9ca3af;">•</td>
                    <td style="padding:0 0 4px 0;">Visit your dashboard at <span style="color:#e5e7eb;">asrarai.com</span> to meet your companions.</td>
                  </tr>
                  <tr>
                    <td valign="top" style="width:18px;padding:0 4px 4px 0;color:#9ca3af;">•</td>
                    <td style="padding:0 0 4px 0;">Choose the companion that fits your mood — deep support, tough love, focus and study, or just laughter.</td>
                  </tr>
                  <tr>
                    <td valign="top" style="width:18px;padding:0 4px 0 0;color:#9ca3af;">•</td>
                    <td style="padding:0;">Start a conversation whenever you need it. No appointments, no awkward waiting rooms — just you and your space.</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 20px 24px;">
                <a
                  href="https://www.asrarai.com/dashboard"
                  style="display:inline-block;padding:11px 28px;border-radius:999px;background-image:linear-gradient(135deg,#22c55e,#4ade80);color:#020617;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;"
                >
                  Open your private space
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 18px 24px;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#d1d5db;">
                  With care,<br />
                  <span style="color:#e5e7eb;">The Asrar AI Team</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 20px 24px;border-top:1px solid #1c2238;background-color:#050814;">
                <p style="margin:0 0 4px 0;font-size:11px;line-height:1.6;color:#9ca3af;">
                  Your messages are encrypted in our database and never used to train public models. Asrar is built to feel like a safe, private corner just for you.
                </p>
                <p style="margin:4px 0 0 0;font-size:11px;line-height:1.6;color:#6b7280;">
                  If you didn’t create this account, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send welcome email:', err && err.message ? err.message : err);
  }
}

module.exports = {
  sendWelcomeEmail,
};

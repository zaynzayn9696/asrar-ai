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
    'Welcome to Asrar AI.',
    'Your account is now created and you have a private emotional space with your companions.',
    '',
    'You can log in any time to continue your conversations and get support in a way that respects your privacy and culture.',
    '',
    'With care,',
    'Asrar AI Team',
  ].join('\n');

  const html = [
    `<p>Hi ${displayName},</p>`,
    '<p>Welcome to <strong>Asrar AI</strong>.</p>',
    '<p>Your account is now created and you have a private emotional space with your companions.</p>',
    '<p>You can log in any time to continue your conversations and get support in a way that respects your privacy and culture.</p>',
    '<p>With care,<br/>Asrar AI Team</p>',
  ].join('');

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

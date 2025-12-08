const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf');

let cachedLogoDataUri = null;

function getLogoDataUri() {
  if (cachedLogoDataUri !== null) return cachedLogoDataUri;

  try {
    const logoPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'assets',
      'asrar-logo.png'
    );
    const file = fs.readFileSync(logoPath);
    const base64 = file.toString('base64');
    cachedLogoDataUri = `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error('[pdf] Failed to load logo for export PDF:', err && err.message ? err.message : err);
    cachedLogoDataUri = null;
  }

  return cachedLogoDataUri;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateTime(date, lang) {
  const d = date instanceof Date ? date : new Date(date);
  const locale = lang === 'ar' ? 'ar' : 'en-US';
  const datePart = d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const timePart = d.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} — ${timePart}`;
}

function getPlanLabel(plan, lang) {
  const p = (plan || '').toLowerCase();
  if (lang === 'ar') {
    if (p === 'pro' || p === 'premium') return 'مميز';
    return 'مجاني';
  }
  if (p === 'pro' || p === 'premium') return 'Premium';
  return 'Free';
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(text || '');
}

function getSpeakerLabel(message, lang) {
  const role = (message.role || '').toLowerCase();
  const id = message.characterId || '';
  if (role === 'user') {
    return lang === 'ar' ? 'أنت' : 'User';
  }

  if (!id) {
    return lang === 'ar' ? 'الرفيق' : 'Companion';
  }

  const base = id.charAt(0).toUpperCase() + id.slice(1);
  if (lang === 'ar') {
    return base; // keep identifier, typically Latin name like "Hana"
  }
  return base;
}

function buildUserExportHtml({ user, messages, usage, lang }) {
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const textAlign = isAr ? 'right' : 'left';
  const accent = '#00D1FF';
  const bg = '#070E13';
  const softText = '#E5F2FF';
  const logoSrc = getLogoDataUri();

  const totalMessages = Array.isArray(messages) ? messages.length : 0;
  const exportDate = formatDateTime(new Date(), lang);

  const userCreatedAt = user && user.createdAt ? formatDateTime(user.createdAt, lang) : '-';
  const planLabel = getPlanLabel(user && user.plan, lang);

  const userName = user && user.name ? user.name : '';
  const userEmail = user && user.email ? user.email : '';

  const userInfoTitle = isAr ? 'معلومات الحساب' : 'Account Information';
  const messagesTitle = isAr ? 'سجل المحادثات' : 'Chat History';
  const nameLabel = isAr ? 'الاسم' : 'Name';
  const emailLabel = isAr ? 'البريد الإلكتروني' : 'Email';
  const planLabelText = isAr ? 'الخطة' : 'Plan';
  const createdLabel = isAr ? 'تاريخ إنشاء الحساب' : 'Account created';
  const totalMessagesLabel = isAr ? 'إجمالي الرسائل' : 'Total messages';

  const mainTitle = 'ASRAR AI — Personal Data Export';
  const mainSubtitle = isAr ? 'تقرير المساحة العاطفية الخاصة' : 'Private Emotional Space Report';

  const noHistoryText = isAr
    ? 'لا توجد رسائل متاحة في هذا التصدير (تم إيقاف حفظ السجل أو لم يتم إرسال رسائل بعد).'
    : 'No messages are available in this export (history is disabled or no messages yet).';

  let messagesHtml;
  if (Array.isArray(messages) && messages.length) {
    const chunks = [];
    messages.forEach((m, index) => {
      const ts = formatDateTime(m.createdAt, lang);
      const speaker = getSpeakerLabel(m, lang);
      const rawContent = m.content || '';
      const isMsgAr = hasArabic(rawContent);
      const msgDir = isMsgAr ? 'rtl' : dir;
      const msgAlign = isMsgAr ? 'right' : textAlign;
      const safeContent = escapeHtml(rawContent).replace(/\n/g, '<br />');

      chunks.push(`
        <div style="padding:10px 0;">
          <div style="font-size:11px;color:#7aa0b5;text-align:center;margin:0 0 4px 0;">[${ts}]</div>
          <div dir="${msgDir}" style="font-size:13px;color:${softText};line-height:1.7;text-align:${msgAlign};word-wrap:break-word;white-space:pre-wrap;">
            <span style="color:${accent};font-weight:600;">${escapeHtml(speaker)}:</span>
            <span> ${safeContent}</span>
          </div>
        </div>
      `);

      if (index < messages.length - 1) {
        chunks.push(`
          <div style="border-top:1px solid rgba(148,163,184,0.28);margin:4px 0 8px 0;"></div>
        `);
      }
    });
    messagesHtml = chunks.join('\n');
  } else {
    messagesHtml = `<p style="margin:0;font-size:13px;color:#9bb0c6;">${escapeHtml(noHistoryText)}</p>`;
  }

  const logoBlock = logoSrc
    ? `<img src="${logoSrc}" alt="Asrar AI" style="width:120px;height:auto;display:block;margin:0 auto 6px auto;" />`
    : `<div style="font-family:'Cinzel','Times New Roman',serif;font-size:24px;letter-spacing:0.24em;text-transform:uppercase;color:#f8fafc;margin-bottom:4px;text-align:center;">ASRAR AI</div>`;

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${mainTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${bg};color:${softText};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;direction:${dir};text-align:${textAlign};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bg};padding:24px 12px;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:720px;background:radial-gradient(circle at top,#050c16 0,#020509 65%,#010308 100%);border-radius:22px;border:1px solid rgba(0,209,255,0.35);box-shadow:0 26px 80px rgba(0,0,0,0.95);padding:22px 20px 24px 20px;">
            <tr>
              <td style="padding:0 4px 14px 4px;">
                <div style="text-align:center;">
                  ${logoBlock}
                  <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accent};margin-bottom:6px;">${escapeHtml(mainSubtitle)}</div>
                  <h1 style="margin:0 0 4px 0;font-size:18px;letter-spacing:0.16em;text-transform:uppercase;color:${softText};">${escapeHtml(mainTitle)}</h1>
                  <div style="font-size:11px;color:#9bb0c6;margin-top:4px;">${escapeHtml(exportDate)}</div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 14px 12px 14px;">
                <div style="border-radius:18px;background:linear-gradient(145deg,rgba(7,19,31,0.98),rgba(3,9,18,0.98));border:1px solid rgba(0,209,255,0.4);box-shadow:0 14px 45px rgba(0,0,0,0.9);padding:16px 18px 12px 18px;margin-bottom:16px;">
                  <div style="font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${accent};margin-bottom:10px;">${escapeHtml(userInfoTitle)}</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:12px;color:${softText};border-collapse:collapse;">
                    <tr>
                      <td style="padding:4px 8px 4px 0;color:#8fa3ba;white-space:nowrap;">${escapeHtml(nameLabel)}</td>
                      <td style="padding:4px 0 4px 4px;color:${softText};line-height:1.6;">${escapeHtml(userName || '-')}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 8px 4px 0;color:#8fa3ba;white-space:nowrap;">${escapeHtml(emailLabel)}</td>
                      <td style="padding:4px 0 4px 4px;color:${softText};line-height:1.6;">${escapeHtml(userEmail || '-')}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 8px 4px 0;color:#8fa3ba;white-space:nowrap;">${escapeHtml(planLabelText)}</td>
                      <td style="padding:4px 0 4px 4px;color:${softText};line-height:1.6;">${escapeHtml(planLabel)}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 8px 4px 0;color:#8fa3ba;white-space:nowrap;">${escapeHtml(createdLabel)}</td>
                      <td style="padding:4px 0 4px 4px;color:${softText};line-height:1.6;">${escapeHtml(userCreatedAt)}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 8px 0 0;color:#8fa3ba;white-space:nowrap;">${escapeHtml(totalMessagesLabel)}</td>
                      <td style="padding:4px 0 0 4px;color:${softText};line-height:1.6;">${totalMessages}</td>
                    </tr>
                  </table>
                </div>

                <div style="border-radius:18px;background:linear-gradient(145deg,rgba(14,11,32,0.98),rgba(5,6,18,0.98));border:1px solid rgba(115,105,255,0.6);box-shadow:0 14px 45px rgba(0,0,0,0.9);padding:16px 18px 14px 18px;">
                  <div style="font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#c4b5ff;margin-bottom:10px;">${escapeHtml(messagesTitle)}</div>
                  ${messagesHtml}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createUserExportPdf({ user, messages, usage, lang }) {
  return new Promise((resolve, reject) => {
    try {
      const html = buildUserExportHtml({ user, messages, usage, lang });
      const options = {
        format: 'A4',
        border: {
          top: '8mm',
          right: '8mm',
          bottom: '10mm',
          left: '8mm',
        },
      };

      pdf.create(html, options).toBuffer((err, buffer) => {
        if (err) {
          console.error('[pdf] Failed to generate export PDF:', err && err.message ? err.message : err);
          return reject(err);
        }
        return resolve(buffer);
      });
    } catch (err) {
      console.error('[pdf] Unexpected error while generating export PDF:', err && err.message ? err.message : err);
      reject(err);
    }
  });
}

module.exports = {
  createUserExportPdf,
};

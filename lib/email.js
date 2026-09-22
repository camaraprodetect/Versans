'use strict';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_PUBLIC_BASE_URL = 'https://versans.com';

function emailConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();
  const replyTo = String(process.env.EMAIL_REPLY_TO || '').trim();
  const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || DEFAULT_PUBLIC_BASE_URL).trim().replace(/\/+$/, '');
  return { apiKey, from, replyTo, publicBaseUrl };
}

function isEmailConfigured() {
  const cfg = emailConfig();
  return !!(cfg.apiKey && cfg.from);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function absoluteUrl(pathOrUrl) {
  const cfg = emailConfig();
  const value = String(pathOrUrl || '').trim();
  if (!value) return cfg.publicBaseUrl + '/';
  if (/^https?:\/\//i.test(value)) return value;
  return cfg.publicBaseUrl + '/' + value.replace(/^\/+/, '');
}

async function sendEmail({ to, subject, html, text, idempotencyKey, headers = {} }) {
  const cfg = emailConfig();
  if (!cfg.apiKey || !cfg.from) {
    const err = new Error('email_not_configured');
    err.code = 'email_not_configured';
    throw err;
  }

  const payload = {
    from: cfg.from,
    to: Array.isArray(to) ? to : [to],
    subject: String(subject || ''),
    html: String(html || ''),
    text: String(text || '')
  };
  if (cfg.replyTo) payload.reply_to = cfg.replyTo;
  if (headers && Object.keys(headers).length) payload.headers = headers;

  const requestHeaders = {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json'
  };
  if (idempotencyKey) requestHeaders['Idempotency-Key'] = String(idempotencyKey).slice(0, 256);

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data && data.message ? data.message : `resend_${response.status}`);
    err.code = data && data.name ? data.name : `resend_${response.status}`;
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

function emailFrame(content, footer = '') {
  const logo = absoluteUrl('/images/VerSansLogoBlackJewlery.png');
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2ef;font-family:Arial,Helvetica,sans-serif;color:#142333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f2ef;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #e6e0d9;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(20,35,51,.08);">
        <tr><td style="padding:30px 34px 18px;text-align:center;border-bottom:1px solid #eee8e2;">
          <img src="${logo}" alt="VerSans" width="170" style="display:block;margin:0 auto;max-width:170px;height:auto;">
        </td></tr>
        <tr><td style="padding:34px;">${content}</td></tr>
        <tr><td style="padding:0 34px 30px;text-align:center;color:#7b858d;font-size:12px;line-height:1.7;">${footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(label, href) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px auto 6px;"><tr><td style="background:#142333;border-radius:10px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function welcomeEmail({ name, couponCode = '', couponExpiresAt = null, couponPercent = 3 }) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'ברוכים הבאים';
  const shopUrl = absoluteUrl('/');
  const safeCouponCode = String(couponCode || '').trim().toUpperCase();
  const percent = Math.max(1, Math.min(100, Number(couponPercent) || 3));
  let expiryLabel = '';
  if (couponExpiresAt) {
    try {
      expiryLabel = new Intl.DateTimeFormat('he-IL', {
        timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(new Date(Number(couponExpiresAt)));
    } catch (_) {}
  }
  const couponBox = safeCouponCode ? `
      <div style="margin:28px auto 8px;max-width:470px;border:1px solid #d7c7ac;background:#fbf8f2;border-radius:16px;padding:22px 18px;text-align:center;">
        <div style="font-size:12px;letter-spacing:1.8px;color:#9a7440;font-weight:700;margin-bottom:8px;">מתנת הצטרפות</div>
        <div style="font-size:28px;line-height:1.15;font-weight:800;color:#142333;">${percent}% הנחה</div>
        <p style="margin:8px 0 14px;font-size:13px;line-height:1.7;color:#68737c;">קופון אישי להזמנה אחת${expiryLabel ? `, בתוקף עד ${escapeHtml(expiryLabel)}` : ', בתוקף ל-14 ימים'}.</p>
        <div style="display:inline-block;direction:ltr;border:1px dashed #9a7440;border-radius:10px;background:#ffffff;padding:11px 18px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;letter-spacing:1.4px;color:#142333;">${escapeHtml(safeCouponCode)}</div>
        <p style="margin:12px 0 0;font-size:12px;color:#7b858d;">הקוד אישי לחשבון שלכם וניתן למימוש פעם אחת.</p>
      </div>` : '';
  const content = `
    <div style="text-align:center;">
      <div style="font-size:12px;letter-spacing:2.4px;color:#9a7440;font-weight:700;margin-bottom:12px;">WELCOME TO VERSANS</div>
      <h1 style="margin:0 0 14px;font-size:34px;line-height:1.15;color:#142333;font-weight:700;">ברוכים הבאים, ${escapeHtml(firstName)}</h1>
      <p style="margin:0 auto;max-width:470px;font-size:16px;line-height:1.8;color:#56616a;">החשבון שלכם נוצר בהצלחה. מעכשיו תוכלו להתחבר ל-VerSans, לנהל את פרטי החשבון ולהמשיך לחנות בצורה מהירה ופשוטה.</p>
      ${couponBox}
      ${button('לחנות', shopUrl)}
      <div style="margin-top:28px;padding-top:22px;border-top:1px solid #eee8e2;font-size:13px;line-height:1.8;color:#7b858d;">זהו אימייל שירותי שנשלח בעקבות יצירת החשבון שלכם.</div>
    </div>`;
  const couponText = safeCouponCode
    ? `\nקופון הצטרפות: ${safeCouponCode} - ${percent}% הנחה להזמנה אחת, בתוקף ${expiryLabel ? `עד ${expiryLabel}` : 'ל-14 ימים'}.`
    : '';
  return {
    subject: 'ברוכים הבאים ל-VerSans',
    html: emailFrame(content, 'VerSans • versans.com'),
    text: `ברוכים הבאים ל-VerSans, ${firstName}. החשבון שלכם נוצר בהצלחה.${couponText}\nלחנות: ${shopUrl}`
  };
}

function productAnnouncementEmail({ name, productTitle, productUrl, imageUrl, unsubscribeUrl }) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `היי ${escapeHtml(firstName)},` : 'היי,';
  const safeTitle = escapeHtml(productTitle || 'מוצר חדש');
  const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${safeTitle}" width="520" style="display:block;width:100%;max-width:520px;height:auto;margin:22px auto;border-radius:14px;border:1px solid #eee8e2;">` : '';
  const content = `
    <div style="text-align:center;">
      <div style="font-size:12px;letter-spacing:2.4px;color:#9a7440;font-weight:700;margin-bottom:12px;">NEW AT VERSANS</div>
      <p style="margin:0 0 8px;font-size:15px;color:#56616a;">${greeting}</p>
      <h1 style="margin:0 0 12px;font-size:30px;line-height:1.25;color:#142333;font-weight:700;">חדש באתר</h1>
      <p style="margin:0 auto;max-width:500px;font-size:17px;line-height:1.7;color:#263642;font-weight:600;">${safeTitle}</p>
      ${image}
      ${button('לצפייה במוצר', productUrl)}
    </div>`;
  const footer = `קיבלתם את האימייל כי בחרתם לקבל עדכונים מ-VerSans.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6c7780;text-decoration:underline;">הסרה מרשימת הדיוור</a>`;
  return {
    subject: `חדש ב-VerSans: ${String(productTitle || 'מוצר חדש')}`,
    html: emailFrame(content, footer),
    text: `${firstName ? `היי ${firstName},\n` : ''}חדש ב-VerSans: ${String(productTitle || 'מוצר חדש')}\n${productUrl}\n\nהסרה מרשימת הדיוור: ${unsubscribeUrl}`
  };
}

module.exports = {
  absoluteUrl,
  emailConfig,
  isEmailConfigured,
  productAnnouncementEmail,
  sendEmail,
  welcomeEmail
};

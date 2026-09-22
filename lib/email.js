'use strict';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_PUBLIC_BASE_URL = 'https://versans.com';

function emailConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();
  const replyTo = String(process.env.EMAIL_REPLY_TO || '').trim();
  const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL).trim().replace(/\/+$/, '');
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


function passwordResetEmail({ name, resetUrl, expiresMinutes = 30 }) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || '';
  const minutes = Math.max(1, Number(expiresMinutes) || 30);
  const content = `
    <div style="text-align:center;">
      <div style="font-size:12px;letter-spacing:2.4px;color:#9a7440;font-weight:700;margin-bottom:12px;">איפוס סיסמה</div>
      <h1 style="margin:0 0 14px;font-size:32px;line-height:1.2;color:#142333;font-weight:700;">איפוס סיסמה${firstName ? `, ${escapeHtml(firstName)}` : ''}</h1>
      <p style="margin:0 auto;max-width:480px;font-size:16px;line-height:1.8;color:#56616a;">קיבלנו בקשה לשינוי הסיסמה בחשבון VerSans שלכם. לחצו על הכפתור כדי לבחור סיסמה חדשה.</p>
      ${button('שינוי סיסמה', resetUrl)}
      <p style="margin:24px auto 0;max-width:480px;font-size:13px;line-height:1.8;color:#7b858d;">הקישור תקף למשך ${minutes} דקות וניתן לשימוש פעם אחת בלבד. אם לא ביקשתם לשנות סיסמה, אפשר להתעלם מהאימייל.</p>
    </div>`;
  return {
    subject: 'איפוס סיסמה לחשבון VerSans',
    html: emailFrame(content, 'VerSans • versans.com'),
    text: `קיבלנו בקשה לשינוי הסיסמה בחשבון VerSans שלכם.\n\nלבחירת סיסמה חדשה: ${resetUrl}\n\nהקישור תקף למשך ${minutes} דקות וניתן לשימוש פעם אחת בלבד. אם לא ביקשתם לשנות סיסמה, אפשר להתעלם מהאימייל.`
  };
}


function moneyLabel(amount, currency = 'ILS') {
  const value = Number(amount) || 0;
  const code = String(currency || 'ILS').toUpperCase();
  return (code === 'ILS' ? '₪' : `${escapeHtml(code)} `) + value.toFixed(2);
}

function orderConfirmationEmail({ orderRef, customer = {}, items = [], orderTotal = 0, currency = 'ILS' }) {
  const fullName = String(customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(' ')).trim();
  const firstName = String(customer.firstName || fullName).trim().split(/\s+/)[0] || '';
  const addressLine = [
    customer.country,
    customer.city,
    [customer.street, customer.houseNumber].filter(Boolean).join(' '),
    customer.apartment ? `דירה ${customer.apartment}` : '',
    customer.entrance ? `כניסה ${customer.entrance}` : '',
    customer.floor ? `קומה ${customer.floor}` : '',
    customer.zip ? `מיקוד ${customer.zip}` : ''
  ].filter(Boolean).join(', ');

  const itemRows = (Array.isArray(items) ? items : []).map((item) => {
    const details = [];
    if (item.selectionsText) details.push(String(item.selectionsText));
    if (item.customName) details.push(`התאמה אישית: ${String(item.customName)}`);
    if (item.greeting && item.greeting.textSummary) details.push(`ברכה אישית: ${String(item.greeting.textSummary)}`);
    const safeName = escapeHtml(item.productName || item.productId || 'מוצר');
    const safeDetails = details.length
      ? `<div style="margin-top:6px;color:#6c7780;font-size:12px;line-height:1.7;">${details.map(escapeHtml).join('<br>')}</div>`
      : '';
    return `<tr>
      <td style="padding:16px 0;border-bottom:1px solid #eee8e2;text-align:right;vertical-align:top;">
        <div style="font-size:15px;font-weight:700;color:#142333;">${safeName}</div>
        ${safeDetails}
      </td>
      <td style="padding:16px 10px;border-bottom:1px solid #eee8e2;text-align:center;vertical-align:top;font-size:14px;color:#56616a;">${Math.max(1, Number(item.quantity) || 1)}</td>
      <td style="padding:16px 0;border-bottom:1px solid #eee8e2;text-align:left;vertical-align:top;font-size:14px;font-weight:700;color:#142333;white-space:nowrap;">${moneyLabel(item.lineTotal, currency)}</td>
    </tr>`;
  }).join('');

  const notes = String(customer.notes || '').trim();
  const content = `
    <div style="text-align:right;">
      <div style="text-align:center;font-size:12px;letter-spacing:2px;color:#9a7440;font-weight:700;margin-bottom:12px;">ORDER CONFIRMATION</div>
      <h1 style="margin:0 0 12px;text-align:center;font-size:30px;line-height:1.25;color:#142333;">תודה${firstName ? `, ${escapeHtml(firstName)}` : ''}</h1>
      <p style="margin:0 auto 26px;max-width:500px;text-align:center;font-size:15px;line-height:1.8;color:#56616a;">ההזמנה שלכם התקבלה בהצלחה. נשמור אתכם מעודכנים לגבי המשך הטיפול והמשלוח.</p>
      <div style="background:#f7f8fa;border:1px solid #e6e9ed;border-radius:12px;padding:14px 16px;margin-bottom:22px;text-align:center;">
        <div style="font-size:12px;color:#7b858d;margin-bottom:5px;">מספר הזמנה</div>
        <div style="font-size:18px;font-weight:800;color:#142333;direction:ltr;">${escapeHtml(orderRef)}</div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <th style="padding:8px 0;text-align:right;font-size:12px;color:#7b858d;">מוצר</th>
          <th style="padding:8px 10px;text-align:center;font-size:12px;color:#7b858d;">כמות</th>
          <th style="padding:8px 0;text-align:left;font-size:12px;color:#7b858d;">סה״כ</th>
        </tr>
        ${itemRows}
      </table>
      <div style="display:flex;justify-content:space-between;gap:16px;margin-top:18px;padding-top:18px;border-top:2px solid #142333;font-size:18px;font-weight:800;color:#142333;">
        <span>סה״כ לתשלום</span><span>${moneyLabel(orderTotal, currency)}</span>
      </div>
      <div style="margin-top:28px;padding:20px;border-radius:12px;background:#fbf8f2;border:1px solid #eee4d5;">
        <div style="font-size:14px;font-weight:800;color:#142333;margin-bottom:8px;">פרטי משלוח</div>
        <div style="font-size:13px;line-height:1.9;color:#56616a;">${escapeHtml(fullName || '-')}<br>${escapeHtml(String(customer.phone || ''))}<br>${escapeHtml(addressLine || '-')}</div>
        ${notes ? `<div style="margin-top:8px;font-size:13px;line-height:1.8;color:#56616a;"><strong>הערה:</strong> ${escapeHtml(notes)}</div>` : ''}
      </div>
    </div>`;

  const textItems = (Array.isArray(items) ? items : []).map((item) => {
    const details = [item.selectionsText, item.customName ? `התאמה אישית: ${item.customName}` : '', item.greeting && item.greeting.textSummary ? `ברכה אישית: ${item.greeting.textSummary}` : ''].filter(Boolean).join(' | ');
    return `- ${item.productName || item.productId || 'מוצר'}${details ? ` (${details})` : ''} x${Math.max(1, Number(item.quantity) || 1)} - ${moneyLabel(item.lineTotal, currency)}`;
  }).join('\n');

  return {
    subject: `אישור הזמנה VerSans - ${String(orderRef || '').trim()}`,
    html: emailFrame(content, 'VerSans • versans.com'),
    text: `ההזמנה שלכם התקבלה בהצלחה.\nמספר הזמנה: ${String(orderRef || '')}\n\n${textItems}\n\nסה״כ: ${moneyLabel(orderTotal, currency)}\n\nפרטי משלוח: ${fullName || '-'}, ${addressLine || '-'}${notes ? `\nהערה: ${notes}` : ''}`
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
  orderConfirmationEmail,
  passwordResetEmail,
  productAnnouncementEmail,
  sendEmail,
  welcomeEmail
};

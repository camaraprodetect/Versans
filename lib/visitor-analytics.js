'use strict';

// First-touch attribution is intentionally limited to broad channels. Raw URLs
// and UTM parameters are never included in aggregate analytics responses.
const KNOWN_UTM = [
  [/^(?:google|googleads|adwords|google_ads|gads|gdn|organic_google|search_google)$/i, 'Google'],
  [/^(?:tiktok|tik_tok|tt|tik-tok)$/i, 'TikTok'],
  [/^(?:instagram|insta|ig|igads|ig_ads)$/i, 'Instagram'],
  [/^(?:facebook|fb|meta|fbads|fb_ads)$/i, 'Facebook'],
  [/^(?:youtube|yt)$/i, 'YouTube'],
  [/^(?:bing|microsoft_ads|msads)$/i, 'Bing'],
  [/^(?:whatsapp|wa|wa_me)$/i, 'WhatsApp'],
  [/^(?:email|e-mail|newsletter|mailchimp)$/i, 'אימייל'],
  [/^(?:pinterest|pin)$/i, 'Pinterest'],
  [/^(?:telegram|tg)$/i, 'Telegram'],
  [/^(?:direct|none|not_set)$/i, 'קישור ישיר']
];

function hostOf(referrer) {
  try {
    const url = new URL(String(referrer || '').trim());
    return /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase().replace(/\.$/, '') : '';
  } catch (_) { return ''; }
}
function domainIs(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

function classifyTrafficSource({ utmSource, referrer } = {}) {
  const source = String(utmSource || '').trim().slice(0, 120);
  if (source) {
    for (const [pattern, label] of KNOWN_UTM) if (pattern.test(source)) return label;
    return 'קמפיין אחר';
  }
  const host = hostOf(referrer);
  if (!host || domainIs(host, 'versans.com') || domainIs(host, 'versans.co.il') || host === 'localhost' || host === '127.0.0.1') return 'קישור ישיר';
  if (domainIs(host, 'tiktok.com')) return 'TikTok';
  if (domainIs(host, 'instagram.com') || domainIs(host, 'ig.me')) return 'Instagram';
  if (domainIs(host, 'facebook.com') || domainIs(host, 'fb.com') || domainIs(host, 'facebook.co') || domainIs(host, 'fb.me')) return 'Facebook';
  if (domainIs(host, 'youtube.com') || domainIs(host, 'youtu.be')) return 'YouTube';
  if (domainIs(host, 'bing.com')) return 'Bing';
  if (domainIs(host, 'whatsapp.com') || domainIs(host, 'wa.me')) return 'WhatsApp';
  if (domainIs(host, 'pinterest.com')) return 'Pinterest';
  if (domainIs(host, 't.me') || domainIs(host, 'telegram.org')) return 'Telegram';
  if (domainIs(host, 'google.com') || /^([^/]+\.)?google\.[a-z.]{2,}$/.test(host) || domainIs(host, 'googleadservices.com')) return 'Google';
  return 'אתרים אחרים';
}

function visitorSource(row) {
  return row.traffic_source || classifyTrafficSource({ utmSource: row.utm_source, referrer: row.referrer });
}

function buildAudienceSummary(rows) {
  const sources = new Map();
  let newVisitors = 0;
  let returningVisitors = 0;
  for (const row of rows || []) {
    const browsers = Math.max(0, Number(row.browser_count || 1));
    if (Number(row.visit_count || 1) > 1) returningVisitors += browsers;
    else newVisitors += browsers;
    const source = visitorSource(row);
    sources.set(source, (sources.get(source) || 0) + browsers);
  }
  const total = newVisitors + returningVisitors;
  return {
    total,
    newVisitors,
    returningVisitors,
    returningPercent: total ? Math.round((returningVisitors / total) * 1000) / 10 : 0,
    sources: [...sources].map(([name, count]) => ({ name, count, percent: total ? Math.round(count / total * 1000) / 10 : 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'))
  };
}

module.exports = { classifyTrafficSource, visitorSource, buildAudienceSummary };

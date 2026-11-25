'use strict';
// Customer-facing visibility is derived from the admin's category flags.
// Never mutate the saved product catalog or the saved marketing configuration.
function isProductInHiddenCategory(product, hiddenCategories = {}) {
  if (!product || typeof product !== 'object') return false;
  const categories = [product.category, ...(Array.isArray(product.categories) ? product.categories : [])]
    .filter(Boolean);

  // Watches are one men's collection in the public storefront.
  // Existing watches tagged watches-women (even without watches-men) are also
  // sold as men's watches. Hiding the unused women's subcategory must not
  // make those watch products disappear from the public catalog or checkout.
  // Keep the main watches and men's visibility controls effective.
  const isWatch = categories.some(category => category === 'watches' || /^watches-(?:men|women)$/.test(category));
  if (isWatch) {
    return hiddenCategories.watches === true || hiddenCategories['watches-men'] === true;
  }

  // Glasses are a single men's collection in the public storefront.
  // Some men's glasses are also tagged "glasses-women" and "glasses-unisex".
  // Hiding the women's collection must not hide these men's products too.
  // Women-only glasses remain editable in the admin; no product data is deleted.
  const isGlasses = categories.some(category => category === 'glasses' || /^glasses-(?:men|women|unisex)$/.test(category));
  if (isGlasses) {
    if (!categories.includes('glasses-men')) return true;
    return hiddenCategories.glasses === true || hiddenCategories['glasses-men'] === true;
  }

  // Other category visibility rules retain their existing behavior.
  return categories.some(category => hiddenCategories[category] === true);
}

const CATEGORY_REFERENCES = {
  hats: /(?:כובע|כובעים|\bhats?\b|\bcaps?\b|\/(?:hats?)(?:[\/?#]|$)|hats?[-_])/i,
  rings: /(?:טבעת|טבעות|\brings?\b|\/rings(?:[\/?#]|$)|ring[-_](?:size|collection))/i,
  'photo-bracelets': /(?:תכשיט(?:ים|י)?\s+(?:עם\s+)?תמונה|תכשיט(?:ים|י)?\s+עם\s+הקרנת\s+תמונה|תמונה\s+(?:מוקרנת|מוצפנת)|הקרנת\s+תמונה|\bphoto[-_ ]?(?:projection|bracelet|jewel(?:ry|lery))\b|\/photo-bracelets(?:[\/?#]|$)|\/photo-projection-bracelet(?:[\/?#]|$)|photo-jewelry[-_])/i
};

function textMentionsHiddenCategory(value, hiddenCategories = {}) {
  const text = String(value == null ? '' : value);
  return Object.entries(CATEGORY_REFERENCES).some(([key, pattern]) => hiddenCategories[key] === true && pattern.test(text));
}
function marketingItemMentionsHiddenCategory(item, hiddenCategories = {}) {
  if (!item || typeof item !== 'object') return false;
  if (item.category && hiddenCategories[item.category] === true) return true;
  // Do not scan IDs (UUIDs) or image filenames unrelated to advertising content.
  return ['title','headline','name','text','detail','description','buttonText','action','url','mediaUrl','video','link']
    .some(field => textMentionsHiddenCategory(item[field], hiddenCategories));
}
function filterPublicMarketingConfig(config, hiddenCategories = {}) {
  const current = config || {};
  return {
    ...current,
    bundles: (current.bundles || []).filter(item => !marketingItemMentionsHiddenCategory(item, hiddenCategories)),
    banners: (current.banners || []).filter(item => !marketingItemMentionsHiddenCategory(item, hiddenCategories)),
    popups: (current.popups || []).filter(item => !marketingItemMentionsHiddenCategory(item, hiddenCategories))
  };
}
function filterPublicPolicyHtml(html, hiddenCategories = {}) {
  let out = String(html || '');
  if (hiddenCategories.hats) {
    out = out.replace(/<li>מחיר כובע:[\s\S]*?<\/li>/g, '');
    out = out.replace(/<li>כובעים: זמן אספקה משוער [\s\S]*?<\/li>/g, '');
    out = out.replace('כובעים, משקפיים ומוצרים מקטגוריות אחרות', 'משקפיים ומוצרים מקטגוריות אחרות');
  }
  if (['rings','photo-bracelets'].some(key => hiddenCategories[key])) {
    const parts = [
      ['תכשיט עם ברכה','greeting'],['שרשראות','necklaces'],['צמידים','bracelets'],
      ['טבעות','rings'],['תכשיטי תמונה','photo-bracelets'],['שעונים','watches']
    ].filter(([,key]) => hiddenCategories[key] !== true).map(([label]) => label);
    const text = parts.length > 1 ? parts.slice(0,-1).join(', ') + ' ו' + parts[parts.length-1] : (parts[0] || '');
    out = out.replace('תכשיט עם ברכה, שרשראות, צמידים, טבעות, תכשיטי תמונה ושעונים', text);
  }
  return out;
}
module.exports = {
  isProductInHiddenCategory,
  textMentionsHiddenCategory,
  marketingItemMentionsHiddenCategory,
  filterPublicMarketingConfig,
  filterPublicPolicyHtml
};

'use strict';

function localText(value, lang = 'he') {
  if (!value) return '';
  if (typeof value === 'string') return String(value);
  if (typeof value === 'object') {
    if (lang === 'en') return String(value.en || value.he || value.id || '');
    return String(value.he || value.en || value.id || '');
  }
  return String(value || '');
}

function optionById(list, id) {
  if (!Array.isArray(list) || !id) return null;
  return list.find((entry) => String(entry && entry.id || '') === String(id || '')) || null;
}

function isRealColorSelector(product, color) {
  if (!product || !color) return false;
  if (color.image) return true;
  const heading = [
    localText(product.colorHeading, 'he'),
    localText(product.colorHeading, 'en'),
    localText(product.colorRequiredText, 'he'),
    localText(product.colorRequiredText, 'en')
  ].join(' ');
  if (/צבע|color/i.test(heading)) return true;
  return product.colorDisplay === 'image-choice' || product.colorDisplay === 'swatch';
}

function colorTokens(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bcolor\b/gi, ' ')
    .replace(/צבע/g, ' ')
    .replace(/[\/|,+()_\-–—]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => (/^ו[\u0590-\u05FF]{2,}$/.test(token) ? token.slice(1) : token))
    .sort()
    .join('|');
}

function suffixMatchesAnyColor(product, suffix, lang) {
  const target = colorTokens(suffix);
  if (!target) return false;
  return (Array.isArray(product && product.colors) ? product.colors : []).some((entry) => {
    const label = localText(entry && entry.label, lang);
    return colorTokens(label) === target;
  });
}

function selectedColorProductName(product, item, lang = 'he') {
  if (!product) return String(item && (item.selectedName || item.name) || '');
  const color = optionById(product.colors, item && item.color);
  const original = localText(product.title, lang) || String(product.id || '');
  if (!color || !isRealColorSelector(product, color)) {
    return String(item && (item.selectedName || item.name) || original);
  }

  const label = localText(color.label, lang) || String(color.id || '');
  if (!label) return original;

  let base = original.trim();

  if (lang === 'he') base = base.replace(/\s*-\s*צבע\s+.+$/u, '').trim();
  else base = base.replace(/\s*-\s*color\s+.+$/i, '').trim();

  if (base === original.trim()) {
    const match = base.match(/^(.*)\s+-\s+([^-\n]+)$/u);
    if (match && suffixMatchesAnyColor(product, match[2], lang)) {
      base = match[1].trim();
    }
  }

  return lang === 'he' ? `${base} - צבע ${label}` : `${base} - ${label}`;
}

function selectedColorProductImage(product, item) {
  if (!product) return String(item && (item.selectedImage || item.image) || '');
  const color = optionById(product.colors, item && item.color);

  if (color && isRealColorSelector(product, color) && color.image) return String(color.image);

  if (product.variantImages && typeof product.variantImages === 'object') {
    const keys = [
      [item && item.size, item && item.necklace, item && item.color].filter(Boolean).join('|'),
      [item && item.size, item && item.necklace].filter(Boolean).join('|'),
      [item && item.necklace, item && item.color].filter(Boolean).join('|'),
      [item && item.size, item && item.color].filter(Boolean).join('|'),
      String(item && item.color || '')
    ].filter(Boolean);

    for (const key of keys) {
      if (product.variantImages[key]) return String(product.variantImages[key]);
    }
  }

  const snapshot = String(item && (item.selectedImage || item.image) || '');
  if (snapshot) return snapshot;
  if (product.cardImage) return String(product.cardImage);
  if (Array.isArray(product.images) && product.images.length) return String(product.images[0]);
  return String(product.hoverImage || '');
}

module.exports = {
  localText,
  optionById,
  isRealColorSelector,
  selectedColorProductName,
  selectedColorProductImage
};

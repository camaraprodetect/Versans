/* ============================================================================
   ליבת התשלום מול HYP (יעד שריג)
   ----------------------------------------------------------------------------
   כל הקוד שמדבר עם חברת הסליקה נמצא כאן בלבד.

   משתני סביבה נדרשים (מוגדרים בפאנל של Vercel / Netlify, לא בקוד):
     HYP_MASOF    – מספר המסוף
     HYP_API_KEY  – מפתח ה-API
     HYP_PASSP    – סיסמת ה-API (PassP)

   חשוב: הסכום לחיוב מחושב כאן מהמחירים שב-products.js, ולא ממה שהדפדפן שלח.
   ============================================================================ */
'use strict';

const { STORE_CONFIG } = require('../assets/config.js');
const { PRODUCTS } = require('../assets/products.js');
const GLASSES_PRICING = require('../assets/glasses-pricing.js');

const HYP_ENDPOINT = 'https://icom.yaad.net/p/';

function credentials() {
  const Masof = process.env.HYP_MASOF;
  const KEY = process.env.HYP_API_KEY;
  const PassP = process.env.HYP_PASSP;
  if (!Masof || !KEY || !PassP) {
    const err = new Error('Missing HYP credentials. Set HYP_MASOF, HYP_API_KEY and HYP_PASSP.');
    err.status = 500;
    throw err;
  }
  return { Masof, KEY, PassP };
}

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 60);
}

function newOrderId() {
  return 'KW-' + Date.now().toString(36).toUpperCase() + '-' +
         Math.random().toString(36).slice(2, 5).toUpperCase();
}

/* מחשב את ההזמנה מהמחירים האמיתיים שבקטלוג */
function optionById(list, id) {
  if (!Array.isArray(list)) return null;
  return list.find((option) => option.id === id) || null;
}

function localText(value, lang) {
  if (!value) return '';
  return value[lang] || value.he || value.en || '';
}

function priceOrder(items, lang) {
  if (!Array.isArray(items) || !items.length) {
    const err = new Error('Cart is empty'); err.status = 400; throw err;
  }

  const lines = [];
  const itemIds = new Set(items.map((item) => item && item.id).filter(Boolean));
  items.forEach((item) => {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (!product) return;

    const qty = Math.min(20, Math.max(1, parseInt(item.qty, 10) || 1));
    let unitPrice = Number(product.price);
    const nameParts = [localText(product.title, lang) || product.id];
    if (product.id === 'love-forever-rose-gift-box-01') {
      const err = new Error('LOVE FOREVER packaging must be attached to a necklace cart line');
      err.status = 400;
      throw err;
    }

    const hasNecklaceOptions = Array.isArray(product.necklaces) && product.necklaces.length;
    const hasBoxOptions = Array.isArray(product.boxes) && product.boxes.length;
    const hasSizeOptions = Array.isArray(product.sizes) && product.sizes.length;
    const hasColorOptions = Array.isArray(product.colors) && product.colors.length;
    const needsCustomName = !!(product.customName && product.customName.required);
    const needsCustomPhoto = !!(product.customPhoto && product.customPhoto.required);

    if (product.requiresCompanion && product.requiresCompanion.required && Array.isArray(product.requiresCompanion.productIds) && product.requiresCompanion.productIds.length) {
      const hasCompanion = product.requiresCompanion.productIds.some((id) => itemIds.has(id));
      if (!hasCompanion) {
        const err = new Error('A compatible necklace is required with this packaging');
        err.status = 400;
        throw err;
      }
    }

    if (hasNecklaceOptions) {
      const necklace = optionById(product.necklaces, item.necklace);
      if (!necklace) {
        const err = new Error('A valid necklace selection is required');
        err.status = 400;
        throw err;
      }
      nameParts.push(localText(necklace.label, lang) || necklace.id);
    }

    if (hasBoxOptions) {
      const box = optionById(product.boxes, item.box);
      if (!box) {
        const err = new Error('A valid box selection is required');
        err.status = 400;
        throw err;
      }
      unitPrice += Number(box.addPrice || 0);
      nameParts.push(localText(box.label, lang) || box.id);
    }

    if (hasSizeOptions) {
      const size = optionById(product.sizes, item.size);
      if (!size) {
        const err = new Error('A valid size selection is required');
        err.status = 400;
        throw err;
      }
      unitPrice += Number(size.addPrice || 0);
      nameParts.push(localText(size.label, lang) || size.id);
    }

    if (hasColorOptions) {
      const color = optionById(product.colors, item.color);
      if (!color) {
        const err = new Error('A valid color selection is required');
        err.status = 400;
        throw err;
      }
      nameParts.push(localText(color.label, lang) || color.id);
    }

    if (item.packaging) {
      if (!product.giftPackaging || !Array.isArray(product.giftPackaging.options)) {
        const err = new Error('Packaging is not available for this product');
        err.status = 400;
        throw err;
      }
      const packaging = optionById(product.giftPackaging.options, item.packaging);
      if (!packaging) {
        const err = new Error('A valid packaging selection is required');
        err.status = 400;
        throw err;
      }
      unitPrice += Number(packaging.addPrice || 0);
      nameParts[0] += lang === 'he' ? ' + מארז LOVE FOREVER' : ' + LOVE FOREVER packaging';
      nameParts.push((lang === 'he' ? 'אריזה: ' : 'Packaging: ') + (localText(packaging.label, lang) || packaging.id));
    }

    if (needsCustomName) {
      const maxLength = Math.max(1, Number(product.customName.maxLength) || 20);
      let customName = clean(item.customName, maxLength).replace(/[|~\[\]]/g, ' ').trim();
      if (product.customName.lettersOnly) {
        customName = customName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, maxLength);
      }
      if (!customName) {
        const err = new Error('A custom name is required');
        err.status = 400;
        throw err;
      }
      if (product.customName.lettersOnly && !/^[A-Z]+$/.test(customName)) {
        const err = new Error('A valid English initial is required');
        err.status = 400;
        throw err;
      }
      const customLabel = localText(product.customName.cartLabel, lang) || (lang === 'he' ? 'שם' : 'Name');
      nameParts.push(customLabel + ': ' + customName);
    }

    if (needsCustomPhoto) {
      const photo = item.customPhoto && typeof item.customPhoto === 'object' ? item.customPhoto : null;
      const assetId = clean(photo && photo.assetId, 100).replace(/[^A-Za-z0-9._-]/g, '');
      const fileName = clean(photo && photo.fileName, 140).replace(/[|~\[\]]/g, ' ');
      if (!assetId) {
        const err = new Error('A custom photo is required');
        err.status = 400;
        throw err;
      }
      const photoLabel = localText(product.customPhoto.cartLabel, lang) || (lang === 'he' ? 'תמונה אישית' : 'Custom photo');
      nameParts.push(photoLabel + ': ' + (fileName || assetId));
    }

    if (/^product-[1-9]$/.test(String(product.slug || '')) && item.greeting && typeof item.greeting === 'object') {
      const allowedTemplates = new Set(['template-1','template-2','template-4','template-5','template-6','template-7','template-8','template-9','template-10','template-11','template-12','template-13','template-15','template-17']);
      const greetingTemplate = allowedTemplates.has(String(item.greeting.template || '')) ? String(item.greeting.template) : 'template-1';
      const signatureMax = greetingTemplate === 'template-1' ? 30 : 28;
      const greetingTitle = clean(item.greeting.title, 15).replace(/[|~\[\]]/g, ' ');
      const greetingMessage = clean(item.greeting.message, 170).replace(/[|~\[\]]/g, ' ');
      const greetingSignature = clean(item.greeting.signature, signatureMax).replace(/[|~\[\]]/g, ' ');
      if (greetingTitle && greetingMessage && greetingSignature) {
        const greetingParts = [greetingTemplate, greetingTitle, greetingMessage, greetingSignature];
        if (greetingTemplate === 'template-1' && /^#[0-9A-Fa-f]{6}$/.test(String(item.greeting.backgroundColor || ''))) greetingParts.push((lang === 'he' ? 'צבע רקע' : 'Background') + ': ' + String(item.greeting.backgroundColor).toUpperCase());
        if (greetingTemplate === 'template-1' && /^#[0-9A-Fa-f]{6}$/.test(String(item.greeting.textColor || ''))) greetingParts.push((lang === 'he' ? 'צבע טקסט' : 'Text color') + ': ' + String(item.greeting.textColor).toUpperCase());
        if (greetingTemplate === 'template-1') {
          const allowedGreetingFonts = new Set(['noto-serif','frank-ruhl','david','heebo','assistant','rubik','alef','varela','miriam','secular']);
          const greetingFont = allowedGreetingFonts.has(String(item.greeting.fontKey || '')) ? String(item.greeting.fontKey) : 'noto-serif';
          greetingParts.push((lang === 'he' ? 'גופן' : 'Font') + ': ' + greetingFont);
        }
        const assetId = clean(item.greeting.assetId, 80).replace(/[^A-Za-z0-9_-]/g, '');
        if (assetId) greetingParts.push((lang === 'he' ? 'קובץ' : 'File') + ': ' + assetId);
        unitPrice += 35;
        nameParts.push((lang === 'he' ? 'ברכה אישית (+35 ₪)' : 'Custom greeting (+₪35)') + ': ' + greetingParts.join(' / '));
      }
    }

    unitPrice = Number(unitPrice.toFixed(2));
    const productCollections = Array.isArray(product.categories) && product.categories.length ? product.categories : [product.category];
    lines.push({
      id: product.id,
      name: nameParts.join(' - '),
      price: unitPrice,
      qty: qty,
      total: Number((unitPrice * qty).toFixed(2)),
      isGlasses: productCollections.includes('glasses')
    });
  });

  if (!lines.length) { const err = new Error('No valid items'); err.status = 400; throw err; }

  const subtotal = Number(lines.reduce((sum, l) => sum + l.total, 0).toFixed(2));
  const unitPrices = [];
  let glassesUnits = 0;
  lines.forEach((line) => {
    for (let i = 0; i < line.qty; i += 1) unitPrices.push(Number(line.price) || 0);
    if (line.isGlasses) glassesUnits += line.qty;
  });

  const secondItemDiscount = unitPrices.length >= 2
    ? Number((Math.min(...unitPrices) * 0.25).toFixed(2))
    : 0;
  const glassesPairs = Math.floor(glassesUnits / 2);
  const glassesBundleDiscount = GLASSES_PRICING.discountForUnits(glassesUnits, 139.9);
  const useGlassesBundle = glassesPairs > 0;
  const discount = useGlassesBundle ? glassesBundleDiscount : secondItemDiscount;
  const discountLabel = useGlassesBundle
    ? (lang === 'he' ? 'מבצע משקפיים - 2 ב־249.90 ₪' : 'Sunglasses offer - 2 for ₪249.90')
    : (lang === 'he' ? '25% הנחה על המוצר השני' : '25% off the second item');

  const freeOver = STORE_CONFIG.shipping.freeOver;
  const shipping = (freeOver && subtotal >= freeOver) ? 0 : Number(STORE_CONFIG.shipping.flat);
  const total = Number(Math.max(0, subtotal - discount + shipping).toFixed(2));

  return { lines, subtotal, discount, discountLabel, shipping, total };
}


/* בונה את רשימת הפריטים לחשבונית של HYP */
function invoiceRows(order) {
  const rows = order.lines.map((l, i) => `[${i}~${l.name.replace(/[~\[\]]/g, ' ')}~${l.qty}~${l.price}]`);
  if (order.discount) rows.push(`[${rows.length}~${String(order.discountLabel || 'Discount').replace(/[~\[\]]/g, ' ')}~1~-${order.discount}]`);
  if (order.shipping) rows.push(`[${rows.length}~Shipping~1~${order.shipping}]`);
  return rows.join(';');
}

/* יוצר קישור לדף התשלום המאובטח */
async function createPaymentUrl(body) {
  const { Masof, KEY, PassP } = credentials();
  const lang = body.lang === 'en' ? 'en' : 'he';
  const customer = body.customer || {};
  const order = priceOrder(body.items, lang);
  const orderId = newOrderId();
  const hyp = STORE_CONFIG.hyp;

  const params = {
    action: 'APISign',
    What: 'SIGN',
    KEY: KEY,
    PassP: PassP,
    Masof: Masof,

    Amount: order.total.toFixed(2),
    Coin: String(STORE_CONFIG.currency.hypCoin),
    Order: orderId,
    Info: clean((STORE_CONFIG.brand.name[lang] || 'Order') + ' ' + orderId, 60),

    ClientName: clean(customer.firstName, 40),
    ClientLName: clean(customer.lastName, 40),
    email: clean(customer.email, 60),
    phone: clean(customer.phone, 20),
    street: clean(customer.street, 60),
    city: clean(customer.city, 40),
    zip: clean(customer.zip, 12),

    Tash: String(hyp.maxPayments || 1),
    FixTash: 'False',
    Postpone: 'False',
    J5: 'False',
    MoreData: 'True',
    sendemail: hyp.sendCustomerEmail ? 'True' : 'False',
    PageLang: hyp.pageLang[lang] || 'HEB',
    tmp: String(hyp.template || '1'),
    UTF8: 'True',
    UTF8out: 'True'
  };

  if (hyp.sendInvoice) {
    params.SendHesh = 'True';
    params.heshDesc = invoiceRows(order);
  }

  const signUrl = HYP_ENDPOINT + '?' + new URLSearchParams(params).toString();
  const response = await fetch(signUrl, { method: 'GET' });
  const text = (await response.text()).trim();

  if (!text || text.indexOf('signature=') === -1) {
    const err = new Error('HYP did not return a signature: ' + text.slice(0, 200));
    err.status = 502;
    throw err;
  }

  const query = text.indexOf('action=') === -1 ? 'action=pay&' + text : text;

  return {
    url: HYP_ENDPOINT + '?' + query,
    order: orderId,
    total: order.total,
    currency: STORE_CONFIG.currency.code
  };
}

/* מאמת מול HYP שהתשלום שחזר באמת אושר */
async function verifyPayment(query) {
  const { Masof, KEY, PassP } = credentials();

  const params = new URLSearchParams();
  params.set('action', 'APISign');
  params.set('What', 'VERIFY');
  params.set('KEY', KEY);
  params.set('PassP', PassP);
  params.set('Masof', Masof);

  Object.keys(query || {}).forEach((k) => {
    if (['action', 'What', 'KEY', 'PassP'].indexOf(k) === -1) params.set(k, query[k]);
  });

  const response = await fetch(HYP_ENDPOINT + '?' + params.toString(), { method: 'GET' });
  const text = (await response.text()).trim();
  const result = Object.fromEntries(new URLSearchParams(text));

  return {
    ok: result.CCode === '0',
    ccode: result.CCode || null,
    order: query.Order || null,
    amount: query.Amount || null,
    raw: text.slice(0, 400)
  };
}

module.exports = { createPaymentUrl, verifyPayment, priceOrder };

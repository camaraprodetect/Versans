'use strict';

/*
 * קישורי מוצר פנימיים לטיפול בהזמנות (למשל קישור רכישה/ספק).
 * המיפוי נשאר בצד השרת בלבד ואינו נשלח ללקוחות באתר.
 *
 * כשיתווספו קישורים, מכניסים אותם לפי slug של המוצר, למשל:
 *   'product-181': 'https://example.com/product'
 */
const ORDER_PRODUCT_LINKS = Object.freeze({
});

function orderProductLink(product) {
  if (!product) return '';
  const slug = String(product.slug || '').trim();
  const id = String(product.id || '').trim();
  return String(ORDER_PRODUCT_LINKS[slug] || ORDER_PRODUCT_LINKS[id] || '').trim();
}

module.exports = { ORDER_PRODUCT_LINKS, orderProductLink };

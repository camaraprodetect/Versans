/* Shared checkout shipping policy. The SERVER always derives prices from trusted catalog lines. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VERSANS_SHIPPING = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var JEWELRY = ['necklaces', 'bracelets', 'rings', 'greeting', 'photo-bracelets', 'photo-jewelry', 'jewelry'];
  function eligible(product) {
    if (!product) return false;
    var categories = Array.isArray(product.categories) ? product.categories.slice() : [];
    if (product.category) categories.push(product.category);
    return categories.some(function (c) { return JEWELRY.indexOf(String(c || '').toLowerCase()) !== -1; });
  }
  function count(lines) {
    return (Array.isArray(lines) ? lines : []).reduce(function (n, l) {
      return n + (eligible(l.p || l.product || l) ? Math.max(0, Math.floor(Number(l.qty) || 0)) : 0);
    }, 0);
  }
  function calculate(lines, method) {
    var items = count(lines);
    var selected = method === 'home' ? 'home' : method === 'pickup' ? 'pickup' : null;
    return {method:selected, jewelryCount:items, homeFree:items >= 2,
      price: selected === 'home' && items < 2 ? 19.90 : 0};
  }
  return {eligible:eligible, count:count, calculate:calculate};
});

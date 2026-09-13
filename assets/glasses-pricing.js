(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VERSANS_GLASSES_PRICING = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var UNIT_PRICE = 139.9;
  var BUNDLE_PRICE = 249.9;

  function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function discountForUnits(units, unitPrice) {
    units = Math.max(0, parseInt(units, 10) || 0);
    unitPrice = Number(unitPrice == null ? UNIT_PRICE : unitPrice);
    var pairs = Math.floor(units / 2);
    return roundMoney(pairs * Math.max(0, unitPrice * 2 - BUNDLE_PRICE));
  }

  function totalForQty(unitPrice, quantity) {
    quantity = Math.max(1, parseInt(quantity, 10) || 1);
    unitPrice = Number(unitPrice == null ? UNIT_PRICE : unitPrice);
    return roundMoney(unitPrice * quantity - discountForUnits(quantity, unitPrice));
  }

  return {
    UNIT_PRICE: UNIT_PRICE,
    BUNDLE_PRICE: BUNDLE_PRICE,
    discountForUnits: discountForUnits,
    totalForQty: totalForQty
  };
});

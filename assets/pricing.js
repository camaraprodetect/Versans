(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VERSANS_PRICING = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var browserRules = null;
  var GLASSES_PAIR_PRICE = 249.90;
  var HATS_PAIR_PRICE = 239.90;
  var HATS_TRIPLE_PRICE = 299.90;
  var BUY2_GET1_CATEGORIES = ['greeting', 'necklaces', 'bracelets', 'rings', 'photo-bracelets', 'watches'];

  function toCents(value) {
    return Math.max(0, Math.round((Number(value) || 0) * 100));
  }

  function fromCents(value) {
    return Math.round(Number(value || 0)) / 100;
  }

  function categoriesFor(line) {
    if (!line) return [];
    if (Array.isArray(line.categories)) return line.categories;
    if (line.p && Array.isArray(line.p.categories) && line.p.categories.length) return line.p.categories;
    var category = line.category || (line.p && line.p.category);
    return category ? [category] : [];
  }

  function isBuy2Get1Eligible(categories) {
    return (categories || []).some(function (category) {
      return BUY2_GET1_CATEGORIES.indexOf(category) !== -1;
    });
  }

  function linePrice(line) {
    if (!line) return 0;
    if (line.unitPrice != null) return Number(line.unitPrice) || 0;
    if (line.price != null) return Number(line.price) || 0;
    return 0;
  }

  function localized(value, lang) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return String(value[lang] || value.he || value.en || '');
  }

  function lineLabel(line, lang) {
    line = line || {};
    var p = line.p || {};
    var title = localized(line.title || p.title || p.cardTitle || p.subtitle, lang);
    return title || (lang === 'he' ? 'מוצר' : 'Product');
  }

  function expandUnits(lines, lang) {
    var units = [];
    (Array.isArray(lines) ? lines : []).forEach(function (line, lineIndex) {
      var qty = Math.max(0, parseInt(line && line.qty, 10) || 0);
      var priceCents = toCents(linePrice(line));
      var categories = categoriesFor(line);
      var label = lineLabel(line, lang);
      for (var i = 0; i < qty; i += 1) {
        units.push({
          lineIndex: lineIndex,
          quantityIndex: i,
          label: label,
          priceCents: priceCents,
          effectiveCents: priceCents,
          bundleApplied: false,
          hatTripleApplied: false,
          isGlasses: !!line.isGlasses || categories.indexOf('glasses') !== -1,
          isHats: !!line.isHats || categories.indexOf('hats') !== -1,
          isBuy2Get1Eligible: isBuy2Get1Eligible(categories)
        });
      }
    });
    return units;
  }

  function distributeBundle(units, indexes, targetCents) {
    if (!indexes.length) return 0;
    indexes.forEach(function (index) { units[index].bundleApplied = true; });
    var original = indexes.reduce(function (sum, index) { return sum + units[index].effectiveCents; }, 0);
    if (original <= targetCents) return 0;

    var base = Math.floor(targetCents / indexes.length);
    var remainder = targetCents - base * indexes.length;
    indexes.forEach(function (index, position) {
      units[index].effectiveCents = base + (position < remainder ? 1 : 0);
    });
    return original - targetCents;
  }

  function sortedIndexes(units, predicate) {
    return units.map(function (_, index) { return index; }).filter(function (index) {
      return predicate(units[index]);
    }).sort(function (a, b) {
      return units[b].effectiveCents - units[a].effectiveCents || a - b;
    });
  }

  function calculate(lines, options) {
    options = options || {};
    var lang = options.lang === 'en' ? 'en' : 'he';
    var units = expandUnits(lines, lang);
    var subtotalCents = units.reduce(function (sum, unit) { return sum + unit.priceCents; }, 0);
    var discountRows = [];

    /* 1) Dynamic category promotions (the original offers are the initial defaults). */
    var chosenRules=Array.isArray(options.bundleRules)?options.bundleRules:browserRules;
    if (!Array.isArray(chosenRules)) chosenRules=[
      {id:"glasses",kind:"fixed",category:"glasses",quantity:2,price:GLASSES_PAIR_PRICE},
      {id:"hats3",kind:"fixed",category:"hats",quantity:3,price:HATS_TRIPLE_PRICE},
      {id:"hats2",kind:"fixed",category:"hats",quantity:2,price:HATS_PAIR_PRICE},
      {id:"jewelry",kind:"buy2get1",category:"jewelry"}
    ];
    var validRules = chosenRules.filter(function(rule){return rule && ['fixed','buy2get1'].indexOf(rule.kind)>=0;});
    function matchesCategory(unit,category){return category==='hats'?unit.isHats:category==='glasses'?unit.isGlasses:unit.isBuy2Get1Eligible;}
    var bundleDiscountCents=0, buy2Get1DiscountCents=0;
    var hatTriples=0,hatsPairs=0,glassesPairs=0,buy2Get1Count=0;
    var byCategory=['hats','glasses','jewelry'];
    byCategory.forEach(function(category){
      var used=Object.create(null);
      // Higher quantities first, same-category offers cannot discount the same unit twice.
      var rules=validRules.filter(function(r){return r.category===category;}).sort(function(a,b){return (Number(b.quantity)||3)-(Number(a.quantity)||3);});
      rules.forEach(function(rule){
        var qty=rule.kind==='buy2get1'?3:Math.max(2,Math.min(20,Math.floor(Number(rule.quantity)||2)));
        var indexes=sortedIndexes(units,function(u){return matchesCategory(u,category) && !used[units.indexOf(u)];});
        for(var cursor=0;cursor+qty<=indexes.length;cursor+=qty){
          var group=indexes.slice(cursor,cursor+qty);
          var original=group.reduce(function(sum,i){return sum+units[i].effectiveCents;},0);
          var target=rule.kind==='buy2get1'?original-Math.min.apply(null,group.map(function(i){return units[i].effectiveCents;})):toCents(rule.price);
          if(target>=original)continue;
          var saving=distributeBundle(units,group,target);
          group.forEach(function(i){used[i]=true;});
          if(rule.kind==='buy2get1'){buy2Get1DiscountCents+=saving;buy2Get1Count++;}
          else {bundleDiscountCents+=saving;if(category==='hats'){if(qty===3)hatTriples++;if(qty===2)hatsPairs++;}if(category==='glasses'&&qty===2)glassesPairs++;}
          if(saving>0)discountRows.push({type:rule.kind==='buy2get1'?'buy-2-get-1':'quantity-bundle',label:rule.name||(rule.kind==='buy2get1'?'מבצע 2+1':qty+' פריטים במבצע'),amount:fromCents(saving)});
        }
      });
    });
    var promotionDiscountCents=bundleDiscountCents+buy2Get1DiscountCents;

    /* 3) Coupon is always applied after every other promotion. */
    var couponPercent = Math.max(0, Math.min(100, Number(options.couponPercent) || 0));
    var couponBaseCents = Math.max(0, subtotalCents - promotionDiscountCents);
    var couponAmountCents=toCents(options.couponAmount||0);
    var couponDiscountCents = Math.min(couponBaseCents, couponAmountCents>0 ? couponAmountCents : (couponPercent>0?Math.round(couponBaseCents * couponPercent / 100):0));
    var couponCode = couponDiscountCents > 0 ? String(options.couponCode || '').trim().toUpperCase() : '';

    var shippingCents = toCents(options.shipping || 0);
    var totalCents = Math.max(0, subtotalCents - promotionDiscountCents - couponDiscountCents + shippingCents);

    return {
      subtotal: fromCents(subtotalCents),
      bundleDiscount: fromCents(bundleDiscountCents),
      buy2Get1Discount: fromCents(buy2Get1DiscountCents),
      discount: fromCents(promotionDiscountCents),
      discountRows: discountRows,
      couponDiscount: fromCents(couponDiscountCents),
      couponPercent: couponPercent,
      couponCode: couponCode,
      shipping: fromCents(shippingCents),
      total: fromCents(totalCents),
      totalSavings: fromCents(promotionDiscountCents + couponDiscountCents),
      buy2Get1Count: buy2Get1Count,
      hatsTriples: hatTriples,
      hatsPairs: hatsPairs,
      glassesPairs: glassesPairs,
      effectiveUnitPrices: units.map(function (unit) { return fromCents(unit.effectiveCents); })
    };
  }

  return {
    GLASSES_PAIR_PRICE: GLASSES_PAIR_PRICE,
    HATS_PAIR_PRICE: HATS_PAIR_PRICE,
    HATS_TRIPLE_PRICE: HATS_TRIPLE_PRICE,
    BUY2_GET1_CATEGORIES: BUY2_GET1_CATEGORIES.slice(),
    setBundleRules: function(rules){browserRules=Array.isArray(rules)?rules:null;},
    calculate: calculate
  };
});

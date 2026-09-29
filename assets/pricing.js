(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VERSANS_PRICING = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

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

    /* 1) Category bundle promotions always apply first. */
    var glasses = sortedIndexes(units, function (unit) { return unit.isGlasses; });
    var glassesPairs = Math.floor(glasses.length / 2);
    var glassesDiscountCents = 0;
    for (var gp = 0; gp < glassesPairs; gp += 1) {
      glassesDiscountCents += distributeBundle(units, glasses.slice(gp * 2, gp * 2 + 2), toCents(GLASSES_PAIR_PRICE));
    }
    if (glassesDiscountCents > 0) {
      discountRows.push({
        type: 'glasses-bundle',
        label: lang === 'he' ? 'מבצע משקפיים · 2 ב־249.90 ₪' : 'Sunglasses offer · 2 for ₪249.90',
        amount: fromCents(glassesDiscountCents)
      });
    }

    var hats = sortedIndexes(units, function (unit) { return unit.isHats; });
    var hatTriples = Math.floor(hats.length / 3);
    var hatCursor = 0;
    var hatsTripleDiscountCents = 0;
    for (var ht = 0; ht < hatTriples; ht += 1) {
      var tripleIndexes = hats.slice(hatCursor, hatCursor + 3);
      tripleIndexes.forEach(function (index) { units[index].hatTripleApplied = true; });
      hatsTripleDiscountCents += distributeBundle(units, tripleIndexes, toCents(HATS_TRIPLE_PRICE));
      hatCursor += 3;
    }
    var hatsPairs = Math.floor((hats.length - hatCursor) / 2);
    var hatsPairDiscountCents = 0;
    for (var hp = 0; hp < hatsPairs; hp += 1) {
      hatsPairDiscountCents += distributeBundle(units, hats.slice(hatCursor, hatCursor + 2), toCents(HATS_PAIR_PRICE));
      hatCursor += 2;
    }
    var hatsDiscountCents = hatsTripleDiscountCents + hatsPairDiscountCents;
    if (hatsDiscountCents > 0) {
      var hatParts = [];
      if (hatTriples > 0) hatParts.push(lang === 'he' ? '3 ב־299.90 ₪' : '3 for ₪299.90');
      if (hatsPairs > 0) hatParts.push(lang === 'he' ? '2 ב־239.90 ₪' : '2 for ₪239.90');
      discountRows.push({
        type: 'hats-bundle',
        label: (lang === 'he' ? 'מבצע כובעים · ' : 'Hats offer · ') + hatParts.join(' + '),
        amount: fromCents(hatsDiscountCents)
      });
    }


    /* 2) Buy 2 + get 1 free applies only to jewelry categories:
       greeting jewelry, necklaces, bracelets, rings, photo jewelry and watches.
       Hats, glasses and every other category never count toward a 2+1 group. */
    var buy2Get1Indexes = units.map(function (_, index) { return index; }).filter(function (index) {
      return units[index].isBuy2Get1Eligible;
    }).sort(function (a, b) {
      return units[b].priceCents - units[a].priceCents || a - b;
    });
    var buy2Get1DiscountCents = 0;
    var buy2Get1Count = 0;
    var buy2Get1Details = [];
    for (var si = 2; si < buy2Get1Indexes.length; si += 3) {
      var discountedUnit = units[buy2Get1Indexes[si]];
      var unitDiscount = discountedUnit.effectiveCents;
      if (unitDiscount > 0) {
        buy2Get1DiscountCents += unitDiscount;
        buy2Get1Count += 1;
        buy2Get1Details.push({
          lineIndex: discountedUnit.lineIndex,
          quantityIndex: discountedUnit.quantityIndex,
          label: discountedUnit.label,
          amount: fromCents(unitDiscount),
          priceBefore: fromCents(discountedUnit.effectiveCents),
          priceAfter: 0
        });
      }
    }
    if (buy2Get1DiscountCents > 0) {
      discountRows.push({
        type: 'buy-2-get-1',
        label: lang === 'he' ? 'מבצע 2+1 על תכשיטים' : 'Buy 2 get 1 free on jewelry',
        amount: fromCents(buy2Get1DiscountCents),
        count: buy2Get1Count,
        details: buy2Get1Details
      });
    }

    var bundleDiscountCents = glassesDiscountCents + hatsDiscountCents;
    var promotionDiscountCents = bundleDiscountCents + buy2Get1DiscountCents;

    /* 3) Coupon is always applied after every other promotion. */
    var couponPercent = Math.max(0, Math.min(100, Number(options.couponPercent) || 0));
    var couponBaseCents = Math.max(0, subtotalCents - promotionDiscountCents);
    var couponDiscountCents = couponPercent > 0 ? Math.round(couponBaseCents * couponPercent / 100) : 0;
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
    calculate: calculate
  };
});

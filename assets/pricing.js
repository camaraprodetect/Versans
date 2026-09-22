(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VERSANS_PRICING = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var GLASSES_PAIR_PRICE = 249.90;
  var HATS_PAIR_PRICE = 239.90;
  var HATS_TRIPLE_PRICE = 299.90;
  var SECOND_ITEM_PERCENT = 10;

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
          isGlasses: !!line.isGlasses || categories.indexOf('glasses') !== -1,
          isHats: !!line.isHats || categories.indexOf('hats') !== -1
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
      hatsTripleDiscountCents += distributeBundle(units, hats.slice(hatCursor, hatCursor + 3), toCents(HATS_TRIPLE_PRICE));
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

    var bundleDiscountCents = glassesDiscountCents + hatsDiscountCents;

    /* 2) 10% off every second item, using prices AFTER bundle promotions.
       Units are ordered high-to-low, so each pair gives 10% off the cheaper item.
       This makes mixed carts predictable and customer-friendly. */
    var byEffectivePrice = units.map(function (_, index) { return index; }).filter(function (index) {
      return !units[index].bundleApplied;
    }).sort(function (a, b) {
      return units[b].effectiveCents - units[a].effectiveCents || a - b;
    });
    var secondItemDiscountCents = 0;
    var secondItemCount = 0;
    var secondItemDetails = [];
    for (var si = 1; si < byEffectivePrice.length; si += 2) {
      var discountedUnit = units[byEffectivePrice[si]];
      var unitDiscount = Math.round(discountedUnit.effectiveCents * SECOND_ITEM_PERCENT / 100);
      if (unitDiscount > 0) {
        secondItemDiscountCents += unitDiscount;
        secondItemCount += 1;
        secondItemDetails.push({
          lineIndex: discountedUnit.lineIndex,
          quantityIndex: discountedUnit.quantityIndex,
          label: discountedUnit.label,
          amount: fromCents(unitDiscount),
          priceBefore: fromCents(discountedUnit.effectiveCents),
          priceAfter: fromCents(Math.max(0, discountedUnit.effectiveCents - unitDiscount))
        });
      }
    }
    if (secondItemDiscountCents > 0) {
      discountRows.push({
        type: 'second-item',
        label: lang === 'he' ? '10% הנחה על כל מוצר שני' : '10% off every second item',
        amount: fromCents(secondItemDiscountCents),
        count: secondItemCount,
        details: secondItemDetails
      });
    }

    var promotionDiscountCents = bundleDiscountCents + secondItemDiscountCents;

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
      secondItemDiscount: fromCents(secondItemDiscountCents),
      discount: fromCents(promotionDiscountCents),
      discountRows: discountRows,
      couponDiscount: fromCents(couponDiscountCents),
      couponPercent: couponPercent,
      couponCode: couponCode,
      shipping: fromCents(shippingCents),
      total: fromCents(totalCents),
      totalSavings: fromCents(promotionDiscountCents + couponDiscountCents),
      secondItemCount: secondItemCount,
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
    SECOND_ITEM_PERCENT: SECOND_ITEM_PERCENT,
    calculate: calculate
  };
});

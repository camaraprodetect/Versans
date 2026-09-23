'use strict';

function orderItemRef(orderRef, itemIndex) {
  const base = String(orderRef || '').trim();
  const index = Math.max(0, Math.trunc(Number(itemIndex) || 0));
  return `${base}-P${String(index + 1).padStart(2, '0')}`;
}

function parseOrderItemRef(value) {
  const input = String(value || '').trim();
  const match = /^(.*)-P(\d{2,3})$/i.exec(input);
  if (!match || !match[1]) return null;
  const oneBased = Number(match[2]);
  if (!Number.isInteger(oneBased) || oneBased < 1) return null;
  return { orderRef: match[1], itemIndex: oneBased - 1 };
}

module.exports = { orderItemRef, parseOrderItemRef };

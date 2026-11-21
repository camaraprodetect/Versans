'use strict';

// Only a fixed-precision decimal amount is admissible as a payment amount.
// Number(''), Number('1e-2'), negatives and fractional agorot must not pass.
function strictAmountAgorot(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/.test(text)) return null;
  const [shekels, cents = ''] = text.split('.');
  const amount = Number(shekels) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}

function assessVerifiedPayment(result, order) {
  if (!result || result.ok !== true) return { ok: false, reason: 'provider_not_verified', amountAgorot: null };
  const returnedRef = String(result.order || '').trim();
  const storedRef = String(order && order.order_ref || '').trim();
  if (!storedRef || !returnedRef || returnedRef !== storedRef) {
    return { ok: false, reason: 'order_mismatch', amountAgorot: null };
  }
  const received = strictAmountAgorot(result.amount);
  if (received === null) return { ok: false, reason: 'missing_or_invalid_amount', amountAgorot: null };
  const expected = Number(order.amount_agorot);
  if (order.amount_agorot === null || order.amount_agorot === undefined || !Number.isSafeInteger(expected) || expected < 0) {
    return { ok: false, reason: 'invalid_stored_amount', amountAgorot: received };
  }
  if (received !== expected) return { ok: false, reason: 'amount_mismatch', amountAgorot: received };
  return { ok: true, reason: 'verified', amountAgorot: received };
}

// Reject multiple signed return fields. The original app used Object.fromEntries,
// which silently kept only the last value of duplicates (Order, Amount or CCode).
function hasUniquePaymentReturnFields(searchParams) {
  if (!searchParams || typeof searchParams.getAll !== 'function') return false;
  return ['Order', 'Amount', 'CCode'].every((key) => searchParams.getAll(key).length === 1);
}

module.exports = { strictAmountAgorot, assessVerifiedPayment, hasUniquePaymentReturnFields };

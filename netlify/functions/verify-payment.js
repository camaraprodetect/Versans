/* אותה פונקציה, בעטיפה של Netlify. משמש רק אם מארחים ב-Netlify. */
'use strict';

const { verifyPayment } = require('../../api/_hyp.js');

exports.handler = async function (event) {
  try {
    const result = await verifyPayment(event.queryStringParameters || {});
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
  } catch (err) {
    console.error('verify-payment failed:', err);
    return { statusCode: err.status || 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

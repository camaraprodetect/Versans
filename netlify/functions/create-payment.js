/* אותה פונקציה, בעטיפה של Netlify. משמש רק אם מארחים ב-Netlify. */
'use strict';

const { createPaymentUrl } = require('../../api/_hyp.js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    const body = JSON.parse(event.body || '{}');
    const result = await createPaymentUrl(body);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
  } catch (err) {
    console.error('create-payment failed:', err);
    return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message }) };
  }
};
